<?php
defined( 'ABSPATH' ) || exit;

final class ViaSetu_Settings {
    const OPTION = 'viasetu_wc_settings';

    public static function init() {
        add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
        add_action( 'admin_init', array( __CLASS__, 'register' ) );
        add_filter( 'plugin_action_links_' . plugin_basename( VIASETU_WC_FILE ), array( __CLASS__, 'action_links' ) );
    }

    public static function defaults() {
        return array(
            'enabled'          => 'yes',
            'api_endpoint'     => 'https://tksfdvnogzsweteetjjw.supabase.co/functions/v1/merchant-api',
            'api_key'          => '',
            'webhook_secret'   => '',
            'pickup_name'      => '',
            'pickup_phone'     => '',
            'pickup_address'   => '',
            'pickup_city'      => '',
            'pickup_state'     => '',
            'pickup_pincode'   => '',
            'shipping_title'   => 'ViaSetu Shipping',
            'default_length'   => '20',
            'default_width'    => '15',
            'default_height'   => '10',
            'auto_create'      => 'no',
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

    public static function menu() {
        add_submenu_page(
            'woocommerce',
            __( 'ViaSetu', 'viasetu-woocommerce' ),
            __( 'ViaSetu', 'viasetu-woocommerce' ),
            'manage_woocommerce',
            'viasetu-settings',
            array( __CLASS__, 'render' )
        );
    }

    public static function action_links( $links ) {
        array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=viasetu-settings' ) ) . '">' . esc_html__( 'Settings', 'viasetu-woocommerce' ) . '</a>' );
        return $links;
    }

    public static function register() {
        register_setting( 'viasetu_wc', self::OPTION, array( 'sanitize_callback' => array( __CLASS__, 'sanitize' ) ) );
    }

    public static function sanitize( $input ) {
        $current = self::get_all();
        $output  = self::defaults();

        $output['enabled']        = isset( $input['enabled'] ) ? 'yes' : 'no';
        $output['auto_create']    = isset( $input['auto_create'] ) ? 'yes' : 'no';
        $output['shipping_title'] = sanitize_text_field( $input['shipping_title'] ?? $current['shipping_title'] );
        $output['api_endpoint']   = esc_url_raw( $input['api_endpoint'] ?? $current['api_endpoint'] );

        if ( 0 !== strpos( $output['api_endpoint'], 'https://' ) ) {
            add_settings_error( self::OPTION, 'endpoint', __( 'The API endpoint must use HTTPS.', 'viasetu-woocommerce' ) );
            $output['api_endpoint'] = $current['api_endpoint'];
        }

        foreach ( array( 'pickup_name', 'pickup_phone', 'pickup_address', 'pickup_city', 'pickup_state', 'pickup_pincode' ) as $field ) {
            $output[ $field ] = sanitize_text_field( $input[ $field ] ?? '' );
        }
        foreach ( array( 'default_length', 'default_width', 'default_height' ) as $field ) {
            $output[ $field ] = (string) max( 1, min( 300, (float) ( $input[ $field ] ?? 10 ) ) );
        }

        foreach ( array( 'api_key', 'webhook_secret' ) as $secret_field ) {
            $new_value = trim( (string) ( $input[ $secret_field ] ?? '' ) );
            if ( '' === $new_value ) {
                $output[ $secret_field ] = $current[ $secret_field ];
                continue;
            }
            $encrypted = self::encrypt( $new_value );
            if ( '' === $encrypted ) {
                add_settings_error( self::OPTION, 'encryption', __( 'ViaSetu credentials were not changed because this server does not provide Sodium or OpenSSL encryption.', 'viasetu-woocommerce' ) );
                $output[ $secret_field ] = $current[ $secret_field ];
                continue;
            }
            $output[ $secret_field ] = $encrypted;
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
            $iv  = substr( $decoded, 0, 12 );
            $tag = substr( $decoded, 12, 16 );
            $plain = openssl_decrypt( substr( $decoded, 28 ), 'aes-256-gcm', self::key(), OPENSSL_RAW_DATA, $iv, $tag );
            return false === $plain ? '' : $plain;
        }
        return '';
    }

    public static function render() {
        if ( ! current_user_can( 'manage_woocommerce' ) ) return;
        $s = self::get_all();
        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'ViaSetu for WooCommerce', 'viasetu-woocommerce' ); ?></h1>
            <p><?php esc_html_e( 'Use a separate ViaSetu merchant API key for this store. The key is encrypted before it is saved.', 'viasetu-woocommerce' ); ?></p>
            <?php settings_errors( self::OPTION ); ?>
            <form method="post" action="options.php">
                <?php settings_fields( 'viasetu_wc' ); ?>
                <table class="form-table" role="presentation">
                    <tr><th><?php esc_html_e( 'Enabled', 'viasetu-woocommerce' ); ?></th><td><label><input type="checkbox" name="<?php echo esc_attr( self::OPTION ); ?>[enabled]" <?php checked( $s['enabled'], 'yes' ); ?>> <?php esc_html_e( 'Enable ViaSetu integration', 'viasetu-woocommerce' ); ?></label></td></tr>
                    <tr><th><label for="viasetu-api-key"><?php esc_html_e( 'Merchant API key', 'viasetu-woocommerce' ); ?></label></th><td><input id="viasetu-api-key" class="regular-text" type="password" autocomplete="new-password" name="<?php echo esc_attr( self::OPTION ); ?>[api_key]" placeholder="<?php echo self::api_key() ? esc_attr__( 'Configured — enter a new key to replace', 'viasetu-woocommerce' ) : 'vs_live_…'; ?>"><p class="description"><?php esc_html_e( 'Never use this key in browser JavaScript.', 'viasetu-woocommerce' ); ?></p></td></tr>
                    <tr><th><label for="viasetu-endpoint"><?php esc_html_e( 'API endpoint', 'viasetu-woocommerce' ); ?></label></th><td><input id="viasetu-endpoint" class="large-text code" type="url" name="<?php echo esc_attr( self::OPTION ); ?>[api_endpoint]" value="<?php echo esc_attr( $s['api_endpoint'] ); ?>"></td></tr>
                    <tr><th><label for="viasetu-webhook-secret"><?php esc_html_e( 'Webhook signing secret', 'viasetu-woocommerce' ); ?></label></th><td><input id="viasetu-webhook-secret" class="regular-text" type="password" autocomplete="new-password" name="<?php echo esc_attr( self::OPTION ); ?>[webhook_secret]" placeholder="<?php echo self::webhook_secret() ? esc_attr__( 'Configured — enter a new secret to replace', 'viasetu-woocommerce' ) : ''; ?>"><p class="description"><?php echo esc_html( rest_url( 'viasetu/v1/webhook' ) ); ?></p></td></tr>
                    <tr><th><?php esc_html_e( 'Pickup address', 'viasetu-woocommerce' ); ?></th><td>
                        <?php foreach ( array( 'pickup_name' => 'Name', 'pickup_phone' => 'Phone', 'pickup_address' => 'Address', 'pickup_city' => 'City', 'pickup_state' => 'State', 'pickup_pincode' => 'Pincode' ) as $field => $label ) : ?>
                            <p><label><?php echo esc_html( $label ); ?><br><input class="regular-text" type="text" name="<?php echo esc_attr( self::OPTION . '[' . $field . ']' ); ?>" value="<?php echo esc_attr( $s[ $field ] ); ?>"></label></p>
                        <?php endforeach; ?>
                    </td></tr>
                    <tr><th><label for="viasetu-title"><?php esc_html_e( 'Checkout title', 'viasetu-woocommerce' ); ?></label></th><td><input id="viasetu-title" class="regular-text" type="text" name="<?php echo esc_attr( self::OPTION ); ?>[shipping_title]" value="<?php echo esc_attr( $s['shipping_title'] ); ?>"></td></tr>
                    <tr><th><?php esc_html_e( 'Default parcel size (cm)', 'viasetu-woocommerce' ); ?></th><td><?php foreach ( array( 'default_length' => 'L', 'default_width' => 'W', 'default_height' => 'H' ) as $field => $label ) : ?><label><?php echo esc_html( $label ); ?> <input class="small-text" type="number" min="1" max="300" name="<?php echo esc_attr( self::OPTION . '[' . $field . ']' ); ?>" value="<?php echo esc_attr( $s[ $field ] ); ?>"></label>&nbsp;<?php endforeach; ?></td></tr>
                    <tr><th><?php esc_html_e( 'Automatic booking', 'viasetu-woocommerce' ); ?></th><td><label><input type="checkbox" name="<?php echo esc_attr( self::OPTION ); ?>[auto_create]" <?php checked( $s['auto_create'], 'yes' ); ?>> <?php esc_html_e( 'Create a shipment when an order enters Processing (only works after ViaSetu enables shipment creation for this account)', 'viasetu-woocommerce' ); ?></label></td></tr>
                </table>
                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }
}
