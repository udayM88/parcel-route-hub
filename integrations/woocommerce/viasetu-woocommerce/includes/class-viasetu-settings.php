<?php
defined( 'ABSPATH' ) || exit;

final class ViaSetu_Settings {
    const OPTION = 'viasetu_wc_settings';

    public static function init() {
        add_action( 'admin_init', array( __CLASS__, 'register' ) );
        add_filter( 'plugin_action_links_' . plugin_basename( VIASETU_WC_FILE ), array( __CLASS__, 'action_links' ) );
    }

    public static function defaults() {
        return array(
            'enabled'                 => 'yes',
            'connection_mode'         => 'api_key',
            'api_endpoint'            => 'https://tksfdvnogzsweteetjjw.supabase.co/functions/v1/merchant-api',
            'api_key'                 => '',
            'webhook_secret'          => '',
            'pickup_name'             => '',
            'pickup_phone'            => '',
            'pickup_address'          => '',
            'pickup_city'             => '',
            'pickup_state'            => '',
            'pickup_pincode'          => '',
            'shipping_title'          => 'ViaSetu Shipping',
            'default_goods_type'      => 'Package',
            'default_length'          => '20',
            'default_width'           => '15',
            'default_height'          => '10',
            'quote_sort'              => 'price',
            'preferred_partners'      => '',
            'max_quotes'              => '3',
            'show_courier'            => 'yes',
            'show_eta'                => 'yes',
            'fallback_enabled'        => 'no',
            'fallback_cost'           => '99',
            'enable_cod'              => 'yes',
            'auto_create'             => 'no',
            'auto_create_statuses'    => array( 'processing' ),
            'sync_interval'           => 'hourly',
            'sync_batch_size'         => '50',
            'complete_when_delivered' => 'yes',
            'debug_logging'           => 'no',
        );
    }

    public static function get_all() {
        return wp_parse_args( get_option( self::OPTION, array() ), self::defaults() );
    }

    public static function get( $key, $fallback = '' ) {
        $settings = self::get_all();
        return isset( $settings[ $key ] ) ? $settings[ $key ] : $fallback;
    }

    public static function api_key() {
        return self::decrypt( self::get( 'api_key' ) );
    }

    public static function webhook_secret() {
        return self::decrypt( self::get( 'webhook_secret' ) );
    }

    public static function action_links( $links ) {
        array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=viasetu' ) ) . '">' . esc_html__( 'Setup', 'viasetu-woocommerce' ) . '</a>' );
        return $links;
    }

    public static function register() {
        register_setting( 'viasetu_wc', self::OPTION, array( 'sanitize_callback' => array( __CLASS__, 'sanitize' ) ) );
    }

    public static function sanitize( $input ) {
        $input   = is_array( $input ) ? $input : array();
        $current = self::get_all();
        $output  = $current;
        $section = sanitize_key( $input['_section'] ?? '' );

        if ( 'connection' === $section ) {
            $output['enabled']         = isset( $input['enabled'] ) ? 'yes' : 'no';
            $output['connection_mode'] = in_array( $input['connection_mode'] ?? '', array( 'api_key', 'portal' ), true ) ? $input['connection_mode'] : 'api_key';
            $endpoint                  = esc_url_raw( $input['api_endpoint'] ?? $current['api_endpoint'] );
            if ( 0 === strpos( $endpoint, 'https://' ) ) $output['api_endpoint'] = $endpoint;
            else add_settings_error( self::OPTION, 'endpoint', __( 'The API endpoint must use HTTPS.', 'viasetu-woocommerce' ) );

            foreach ( array( 'api_key', 'webhook_secret' ) as $secret_field ) {
                $new_value = trim( (string) ( $input[ $secret_field ] ?? '' ) );
                if ( '' === $new_value ) continue;
                $encrypted = self::encrypt( $new_value );
                if ( '' === $encrypted ) {
                    add_settings_error( self::OPTION, 'encryption', __( 'Credentials were not changed because this server does not provide Sodium or OpenSSL encryption.', 'viasetu-woocommerce' ) );
                    continue;
                }
                $output[ $secret_field ] = $encrypted;
            }
        }

        if ( 'shipping' === $section ) {
            foreach ( array( 'pickup_name', 'pickup_phone', 'pickup_address', 'pickup_city', 'pickup_state', 'pickup_pincode', 'shipping_title', 'default_goods_type' ) as $field ) {
                $output[ $field ] = sanitize_text_field( wp_unslash( $input[ $field ] ?? '' ) );
            }
            foreach ( array( 'default_length', 'default_width', 'default_height' ) as $field ) {
                $output[ $field ] = (string) max( 1, min( 300, (float) ( $input[ $field ] ?? 10 ) ) );
            }
            $output['quote_sort']         = in_array( $input['quote_sort'] ?? '', array( 'price', 'fastest', 'preferred' ), true ) ? $input['quote_sort'] : 'price';
            $output['preferred_partners'] = sanitize_text_field( wp_unslash( $input['preferred_partners'] ?? '' ) );
            $output['max_quotes']         = (string) max( 1, min( 5, absint( $input['max_quotes'] ?? 3 ) ) );
            $output['fallback_cost']      = (string) max( 0, (float) ( $input['fallback_cost'] ?? 0 ) );
            foreach ( array( 'show_courier', 'show_eta', 'fallback_enabled', 'enable_cod' ) as $field ) $output[ $field ] = isset( $input[ $field ] ) ? 'yes' : 'no';
        }

        if ( 'sync' === $section ) {
            $allowed_statuses = array( 'pending', 'on-hold', 'processing', 'completed' );
            $statuses = array_map( 'sanitize_key', (array) ( $input['auto_create_statuses'] ?? array() ) );
            $output['auto_create_statuses']    = array_values( array_intersect( $statuses, $allowed_statuses ) );
            $output['auto_create']             = isset( $input['auto_create'] ) ? 'yes' : 'no';
            $output['complete_when_delivered'] = isset( $input['complete_when_delivered'] ) ? 'yes' : 'no';
            $output['debug_logging']           = isset( $input['debug_logging'] ) ? 'yes' : 'no';
            $output['sync_interval']           = in_array( $input['sync_interval'] ?? '', array( 'viasetu_15_minutes', 'hourly', 'twicedaily' ), true ) ? $input['sync_interval'] : 'hourly';
            $output['sync_batch_size']         = (string) max( 10, min( 200, absint( $input['sync_batch_size'] ?? 50 ) ) );
            if ( function_exists( 'viasetu_wc_reschedule_sync' ) ) viasetu_wc_reschedule_sync( $output['sync_interval'] );
        }

        return $output;
    }

    private static function key() {
        return hash( 'sha256', wp_salt( 'auth' ), true );
    }

    public static function encrypt( $value ) {
        if ( '' === $value ) return '';
        if ( function_exists( 'sodium_crypto_secretbox' ) ) {
            $nonce  = random_bytes( SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
            $cipher = sodium_crypto_secretbox( $value, $nonce, self::key() );
            return 'sodium:' . base64_encode( $nonce . $cipher );
        }
        if ( function_exists( 'openssl_encrypt' ) ) {
            $iv     = random_bytes( 12 );
            $tag    = '';
            $cipher = openssl_encrypt( $value, 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag );
            if ( false !== $cipher ) return 'openssl:' . base64_encode( $iv . $tag . $cipher );
        }
        return '';
    }

    public static function decrypt( $value ) {
        if ( ! is_string( $value ) || '' === $value ) return '';
        if ( 0 === strpos( $value, 'sodium:' ) && function_exists( 'sodium_crypto_secretbox_open' ) ) {
            $decoded = base64_decode( substr( $value, 7 ), true );
            if ( false === $decoded || strlen( $decoded ) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ) return '';
            $nonce = substr( $decoded, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
            $plain = sodium_crypto_secretbox_open( substr( $decoded, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ), $nonce, self::key() );
            return false === $plain ? '' : $plain;
        }
        if ( 0 === strpos( $value, 'openssl:' ) && function_exists( 'openssl_decrypt' ) ) {
            $decoded = base64_decode( substr( $value, 8 ), true );
            if ( false === $decoded || strlen( $decoded ) <= 28 ) return '';
            $plain = openssl_decrypt( substr( $decoded, 28 ), 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, substr( $decoded, 0, 12 ), substr( $decoded, 12, 16 ) );
            return false === $plain ? '' : $plain;
        }
        return '';
    }
}
