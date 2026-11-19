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
            'connect_endpoint'        => 'https://tksfdvnogzsweteetjjw.supabase.co/functions/v1/woocommerce-connect',
            'connect_portal_url'      => 'https://www.viasetu.com/viasetuforbusinesses/connect/woocommerce',
            'api_key'                 => '',
            'webhook_secret'          => '',
            'connection_id'           => '',
            'merchant_company'        => '',
            'merchant_email'          => '',
            'connected_at'            => '',
            'connection_last_checked' => '',
            'connection_last_status'  => 'unverified',
            'connection_last_error'   => '',
            'connection_key_fingerprint' => '',
            'environment'             => self::package_environment(),
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
            'booking_retry_enabled'   => 'yes',
            'booking_retry_limit'     => '3',
            'sync_interval'           => 'hourly',
            'sync_batch_size'         => '50',
            'complete_when_delivered' => 'yes',
            'debug_logging'           => 'no',
            'label_paper'             => 'a4',
            'label_format'            => 'pdf',
            'label_show_order_number' => 'yes',
            'label_auto_fetch'        => 'yes',
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

    public static function package_environment() {
        return defined( 'VIASETU_WC_DEMO_MODE' ) && VIASETU_WC_DEMO_MODE ? 'sandbox' : 'live';
    }

    public static function is_sandbox_package() {
        return 'sandbox' === self::package_environment();
    }

    public static function is_connected() {
        return 'yes' === self::get( 'enabled' )
            && self::package_environment() === self::get( 'environment' )
            && self::api_key_is_valid( self::api_key(), self::package_environment() );
    }

    public static function api_key_is_valid( $api_key, $environment = '' ) {
        $api_key = trim( (string) $api_key );
        if ( ! preg_match( '/^vs_(live|test)_[0-9a-f]{48}$/', $api_key, $matches ) ) return false;
        $secret = substr( $api_key, -48 );
        if ( preg_match( '/^([0-9a-f])\1{47}$/', $secret ) ) return false;
        if ( 'live' === $environment && 'live' !== $matches[1] ) return false;
        if ( 'sandbox' === $environment && 'test' !== $matches[1] ) return false;
        return true;
    }

    public static function api_key_environment( $api_key ) {
        if ( preg_match( '/^vs_(live|test)_[0-9a-f]{48}$/', trim( (string) $api_key ), $matches ) ) {
            return 'test' === $matches[1] ? 'sandbox' : 'live';
        }
        return '';
    }

    public static function key_fingerprint( $api_key = null ) {
        $api_key = null === $api_key ? self::api_key() : trim( (string) $api_key );
        return '' === $api_key ? '' : substr( hash( 'sha256', $api_key ), 0, 12 );
    }

    public static function mark_connection_checked( $success, $message = '' ) {
        $settings                               = self::get_all();
        $settings['connection_last_checked']    = current_time( 'mysql', true );
        $settings['connection_last_status']     = $success ? 'verified' : 'failed';
        $settings['connection_last_error']      = $success ? '' : sanitize_text_field( $message );
        $settings['connection_key_fingerprint'] = self::key_fingerprint();
        update_option( self::OPTION, $settings, false );
    }

    public static function connection_is_verified() {
        return self::is_connected()
            && 'verified' === self::get( 'connection_last_status' )
            && hash_equals( (string) self::get( 'connection_key_fingerprint' ), (string) self::key_fingerprint() );
    }

    public static function pickup_errors() {
        $fields = array(
            'pickup_name'    => __( 'Pickup contact name is required.', 'viasetu-woocommerce' ),
            'pickup_address' => __( 'Pickup address is required.', 'viasetu-woocommerce' ),
            'pickup_city'    => __( 'Pickup city is required.', 'viasetu-woocommerce' ),
            'pickup_state'   => __( 'Pickup state is required.', 'viasetu-woocommerce' ),
        );
        $errors = array();
        foreach ( $fields as $field => $message ) {
            if ( strlen( trim( (string) self::get( $field ) ) ) < 2 ) $errors[] = $message;
        }
        $phone = preg_replace( '/\D+/', '', (string) self::get( 'pickup_phone' ) );
        if ( strlen( $phone ) > 10 ) $phone = substr( $phone, -10 );
        if ( ! preg_match( '/^\d{10}$/', $phone ) ) $errors[] = __( 'Pickup phone must contain 10 digits.', 'viasetu-woocommerce' );
        if ( ! preg_match( '/^\d{6}$/', (string) self::get( 'pickup_pincode' ) ) ) $errors[] = __( 'Pickup pincode must contain 6 digits.', 'viasetu-woocommerce' );
        return array_values( array_unique( $errors ) );
    }

    public static function pickup_is_complete() {
        return empty( self::pickup_errors() );
    }

    public static function store_connection( $api_key, $webhook_secret, $connection_id, $environment, $merchant = array() ) {
        $environment = 'sandbox' === $environment ? 'sandbox' : 'live';
        if ( self::package_environment() !== $environment ) return false;
        if ( ! self::api_key_is_valid( $api_key, $environment ) || strlen( trim( (string) $webhook_secret ) ) < 32 ) return false;
        $encrypted_key    = self::encrypt( trim( (string) $api_key ) );
        $encrypted_secret = self::encrypt( trim( (string) $webhook_secret ) );
        if ( '' === $encrypted_key || '' === $encrypted_secret ) return false;

        $settings                       = self::get_all();
        $settings['enabled']            = 'yes';
        $settings['connection_mode']    = 'one_click';
        $settings['api_key']            = $encrypted_key;
        $settings['webhook_secret']     = $encrypted_secret;
        $settings['connection_id']      = sanitize_text_field( $connection_id );
        $settings['environment']        = $environment;
        $settings['merchant_company']   = sanitize_text_field( $merchant['company_name'] ?? '' );
        $settings['merchant_email']     = sanitize_email( $merchant['email'] ?? '' );
        $settings['connected_at']       = current_time( 'mysql', true );
        $settings['connection_last_checked'] = '';
        $settings['connection_last_status']  = 'unverified';
        $settings['connection_last_error']   = '';
        $settings['connection_key_fingerprint'] = self::key_fingerprint( $api_key );
        update_option( self::OPTION, $settings, false );
        return true;
    }

    public static function clear_connection() {
        $settings = self::get_all();
        foreach ( array( 'api_key', 'webhook_secret', 'connection_id', 'merchant_company', 'merchant_email', 'connected_at', 'connection_last_checked', 'connection_last_error', 'connection_key_fingerprint' ) as $key ) {
            $settings[ $key ] = '';
        }
        $settings['connection_last_status'] = 'unverified';
        update_option( self::OPTION, $settings, false );
    }

    public static function encryption_available() {
        return function_exists( 'sodium_crypto_secretbox' ) || function_exists( 'openssl_encrypt' );
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
            $output['connection_mode'] = 'api_key';
            $endpoint                  = esc_url_raw( $input['api_endpoint'] ?? $current['api_endpoint'] );
            if ( 0 === strpos( $endpoint, 'https://' ) ) $output['api_endpoint'] = $endpoint;
            else add_settings_error( self::OPTION, 'endpoint', __( 'The API endpoint must use HTTPS.', 'viasetu-woocommerce' ) );

            foreach ( array( 'api_key', 'webhook_secret' ) as $secret_field ) {
                $new_value = trim( (string) ( $input[ $secret_field ] ?? '' ) );
                if ( '' === $new_value ) continue;
                if ( 'api_key' === $secret_field && ! self::api_key_is_valid( $new_value, self::package_environment() ) ) {
                    $required_prefix = self::is_sandbox_package() ? 'vs_test_' : 'vs_live_';
                    add_settings_error( self::OPTION, 'api_key', sprintf( __( 'This package accepts only a complete %s key supplied by ViaSetu.', 'viasetu-woocommerce' ), $required_prefix ) );
                    continue;
                }
                if ( 'webhook_secret' === $secret_field && strlen( $new_value ) < 32 ) {
                    add_settings_error( self::OPTION, 'webhook_secret', __( 'The webhook signing secret must contain at least 32 characters.', 'viasetu-woocommerce' ) );
                    continue;
                }
                $encrypted = self::encrypt( $new_value );
                if ( '' === $encrypted ) {
                    add_settings_error( self::OPTION, 'encryption', __( 'Credentials were not changed because this server does not provide Sodium or OpenSSL encryption.', 'viasetu-woocommerce' ) );
                    continue;
                }
                $output[ $secret_field ] = $encrypted;
                if ( 'api_key' === $secret_field ) {
                    $output['environment']                = self::api_key_environment( $new_value );
                    $output['connection_last_checked']    = '';
                    $output['connection_last_status']     = 'unverified';
                    $output['connection_last_error']      = '';
                    $output['connection_key_fingerprint'] = self::key_fingerprint( $new_value );
                }
            }
        }

        if ( 'shipping' === $section ) {
            foreach ( array( 'pickup_name', 'pickup_phone', 'pickup_address', 'pickup_city', 'pickup_state', 'pickup_pincode', 'shipping_title', 'default_goods_type' ) as $field ) {
                $output[ $field ] = sanitize_text_field( wp_unslash( $input[ $field ] ?? '' ) );
            }
            $output['pickup_phone']   = substr( preg_replace( '/\D+/', '', $output['pickup_phone'] ), -10 );
            $output['pickup_pincode'] = substr( preg_replace( '/\D+/', '', $output['pickup_pincode'] ), 0, 6 );
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
            $output['booking_retry_enabled']   = isset( $input['booking_retry_enabled'] ) ? 'yes' : 'no';
            $output['booking_retry_limit']     = (string) max( 1, min( 5, absint( $input['booking_retry_limit'] ?? 3 ) ) );
            $output['complete_when_delivered'] = isset( $input['complete_when_delivered'] ) ? 'yes' : 'no';
            $output['debug_logging']           = isset( $input['debug_logging'] ) ? 'yes' : 'no';
            $output['sync_interval']           = in_array( $input['sync_interval'] ?? '', array( 'viasetu_15_minutes', 'hourly', 'twicedaily' ), true ) ? $input['sync_interval'] : 'hourly';
            $output['sync_batch_size']         = (string) max( 10, min( 200, absint( $input['sync_batch_size'] ?? 50 ) ) );
            if ( function_exists( 'viasetu_wc_reschedule_sync' ) ) viasetu_wc_reschedule_sync( $output['sync_interval'] );
        }

        if ( 'labels' === $section ) {
            $output['label_auto_fetch'] = isset( $input['label_auto_fetch'] ) ? 'yes' : 'no';
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
