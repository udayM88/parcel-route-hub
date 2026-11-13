<?php
defined( 'ABSPATH' ) || exit;

final class ViaSetu_Connect {
    const TRANSIENT_PREFIX = 'viasetu_wc_connect_';

    public static function init() {
        add_action( 'admin_post_viasetu_connect_start', array( __CLASS__, 'start' ) );
        add_action( 'admin_post_viasetu_connect_callback', array( __CLASS__, 'callback' ) );
        add_action( 'admin_post_viasetu_disconnect', array( __CLASS__, 'disconnect' ) );
    }

    private static function require_admin() {
        if ( ! current_user_can( 'manage_woocommerce' ) ) {
            wp_die( esc_html__( 'You do not have permission to connect ViaSetu.', 'viasetu-woocommerce' ) );
        }
    }

    private static function notice( $message, $type = 'success' ) {
        set_transient(
            'viasetu_wc_notice_' . get_current_user_id(),
            array( 'message' => sanitize_text_field( $message ), 'type' => sanitize_key( $type ) ),
            60
        );
    }

    private static function redirect_connection() {
        wp_safe_redirect( admin_url( 'admin.php?page=viasetu&tab=connection' ) );
        exit;
    }

    private static function callback_url() {
        return admin_url( 'admin-post.php?action=viasetu_connect_callback' );
    }

    private static function site_url() {
        return untrailingslashit( home_url( '/' ) );
    }

    private static function environment() {
        return defined( 'VIASETU_WC_DEMO_MODE' ) && VIASETU_WC_DEMO_MODE ? 'sandbox' : 'live';
    }

    public static function start_url() {
        return wp_nonce_url( admin_url( 'admin-post.php?action=viasetu_connect_start' ), 'viasetu_connect_start' );
    }

    public static function disconnect_url() {
        return wp_nonce_url( admin_url( 'admin-post.php?action=viasetu_disconnect' ), 'viasetu_disconnect' );
    }

    public static function start() {
        self::require_admin();
        check_admin_referer( 'viasetu_connect_start' );

        if ( ! ViaSetu_Settings::encryption_available() ) {
            self::notice( __( 'Connection stopped because this server cannot encrypt credentials. Enable Sodium or OpenSSL.', 'viasetu-woocommerce' ), 'error' );
            self::redirect_connection();
        }

        if ( defined( 'VIASETU_WC_DEMO_MODE' ) && VIASETU_WC_DEMO_MODE ) {
            $key = 'vs_test_' . str_repeat( '0', 48 );
            ViaSetu_Settings::store_connection( $key, str_repeat( 'd', 64 ), 'demo-connection', 'sandbox', array( 'company_name' => 'ViaSetu Demo Store', 'email' => get_option( 'admin_email' ) ) );
            self::notice( __( 'Demo workspace connected locally. No ViaSetu or courier request was sent.', 'viasetu-woocommerce' ) );
            self::redirect_connection();
        }

        if ( ! is_ssl() || 0 !== strpos( self::site_url(), 'https://' ) ) {
            self::notice( __( 'A production ViaSetu connection requires WordPress and Home URLs to use HTTPS.', 'viasetu-woocommerce' ), 'error' );
            self::redirect_connection();
        }

        $state     = wp_generate_password( 48, false, false );
        $verifier  = wp_generate_password( 64, false, false );
        $challenge = rtrim( strtr( base64_encode( hash( 'sha256', $verifier, true ) ), '+/', '-_' ), '=' );
        $request   = array(
            'state'         => $state,
            'code_verifier' => $verifier,
            'site_url'      => self::site_url(),
            'redirect_uri'  => self::callback_url(),
            'webhook_url'   => rest_url( 'viasetu/v1/webhook' ),
            'environment'   => self::environment(),
            'created_at'    => time(),
        );
        set_transient( self::TRANSIENT_PREFIX . get_current_user_id(), $request, 10 * MINUTE_IN_SECONDS );

        $url = add_query_arg(
            array(
                'site_url'       => $request['site_url'],
                'redirect_uri'   => $request['redirect_uri'],
                'webhook_url'    => $request['webhook_url'],
                'code_challenge' => $challenge,
                'state'          => $state,
                'store_name'     => get_bloginfo( 'name' ) ?: wp_parse_url( home_url(), PHP_URL_HOST ),
                'environment'    => $request['environment'],
                'plugin_version' => VIASETU_WC_VERSION,
            ),
            ViaSetu_Settings::get( 'connect_portal_url' )
        );
        wp_redirect( esc_url_raw( $url ) ); // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect -- intentional cross-origin merchant authorization.
        exit;
    }

    public static function callback() {
        self::require_admin();
        $saved = get_transient( self::TRANSIENT_PREFIX . get_current_user_id() );
        $state = sanitize_text_field( wp_unslash( $_GET['state'] ?? '' ) );
        $code  = sanitize_text_field( wp_unslash( $_GET['code'] ?? '' ) );
        if ( ! is_array( $saved ) || ! $state || ! $code || ! hash_equals( (string) $saved['state'], $state ) || time() - (int) $saved['created_at'] > 600 ) {
            self::notice( __( 'The ViaSetu connection link is invalid or expired. Start again.', 'viasetu-woocommerce' ), 'error' );
            self::redirect_connection();
        }
        delete_transient( self::TRANSIENT_PREFIX . get_current_user_id() );

        $response = wp_safe_remote_post(
            ViaSetu_Settings::get( 'connect_endpoint' ),
            array(
                'headers'             => array( 'Content-Type' => 'application/json' ),
                'body'                => wp_json_encode(
                    array(
                        'action'        => 'exchange',
                        'code'          => $code,
                        'code_verifier' => $saved['code_verifier'],
                        'site_url'      => $saved['site_url'],
                        'redirect_uri'  => $saved['redirect_uri'],
                        'webhook_url'   => $saved['webhook_url'],
                        'environment'   => $saved['environment'],
                    )
                ),
                'timeout'             => 20,
                'redirection'         => 0,
                'limit_response_size' => 128 * KB_IN_BYTES,
            )
        );
        if ( is_wp_error( $response ) ) {
            ViaSetu_Logger::log( 'error', 'Store connection exchange failed', array( 'error' => $response->get_error_message() ) );
            self::notice( __( 'ViaSetu could not complete the secure connection. Try again.', 'viasetu-woocommerce' ), 'error' );
            self::redirect_connection();
        }
        $data = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) || empty( $data['success'] ) || empty( $data['api_key'] ) || empty( $data['webhook_secret'] ) ) {
            self::notice( sanitize_text_field( $data['error'] ?? __( 'ViaSetu rejected the connection request.', 'viasetu-woocommerce' ) ), 'error' );
            self::redirect_connection();
        }
        if ( ! ViaSetu_Settings::store_connection( $data['api_key'], $data['webhook_secret'], $data['connection_id'] ?? '', $data['environment'] ?? 'live', $data['merchant'] ?? array() ) ) {
            self::notice( __( 'The store was authorized but WordPress could not encrypt the credentials. Reconnect after enabling server encryption.', 'viasetu-woocommerce' ), 'error' );
            self::redirect_connection();
        }
        ViaSetu_Logger::log( 'success', 'WooCommerce store connected to merchant account' );
        self::notice( __( 'ViaSetu Merchant is connected. Orders, billing, labels and tracking are ready.', 'viasetu-woocommerce' ) );
        self::redirect_connection();
    }

    public static function disconnect() {
        self::require_admin();
        check_admin_referer( 'viasetu_disconnect' );
        if ( ViaSetu_Settings::api_key() && ! ( defined( 'VIASETU_WC_DEMO_MODE' ) && VIASETU_WC_DEMO_MODE ) ) {
            $result = ( new ViaSetu_Api_Client() )->disconnect();
            if ( is_wp_error( $result ) ) {
                self::notice( sprintf( __( 'ViaSetu could not revoke this connection: %s', 'viasetu-woocommerce' ), $result->get_error_message() ), 'error' );
                self::redirect_connection();
            }
        }
        ViaSetu_Settings::clear_connection();
        ViaSetu_Logger::log( 'success', 'WooCommerce store disconnected' );
        self::notice( __( 'ViaSetu Merchant was disconnected and its local credentials were removed.', 'viasetu-woocommerce' ) );
        self::redirect_connection();
    }
}
