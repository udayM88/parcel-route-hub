<?php
defined( 'ABSPATH' ) || exit;

final class ViaSetu_Admin {
    private static $tabs = array(
        'dashboard'   => 'Dashboard',
        'connection'  => 'Connection',
        'shipping'    => 'Shipping & checkout',
        'products'    => 'Products',
        'sync'        => 'Sync & webhooks',
        'diagnostics' => 'Diagnostics',
    );

    public static function init() {
        add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
        add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
        add_action( 'admin_post_viasetu_test_connection', array( __CLASS__, 'test_connection' ) );
        add_action( 'admin_post_viasetu_sync_now', array( __CLASS__, 'sync_now' ) );
        add_action( 'admin_post_viasetu_clear_logs', array( __CLASS__, 'clear_logs' ) );
        add_action( 'admin_init', array( __CLASS__, 'activation_redirect' ) );
    }

    public static function menu() {
        add_menu_page( 'ViaSetu', 'ViaSetu', 'manage_woocommerce', 'viasetu', array( __CLASS__, 'render' ), 'dashicons-location-alt', 56 );
    }

    public static function assets( $hook ) {
        if ( 'toplevel_page_viasetu' !== $hook ) return;
        wp_enqueue_style( 'viasetu-wc-admin', plugins_url( 'assets/admin.css', VIASETU_WC_FILE ), array(), VIASETU_WC_VERSION );
    }

    public static function activation_redirect() {
        if ( ! get_transient( 'viasetu_wc_activation_redirect' ) ) return;
        delete_transient( 'viasetu_wc_activation_redirect' );
        if ( wp_doing_ajax() || is_network_admin() || isset( $_GET['activate-multi'] ) || ! current_user_can( 'manage_woocommerce' ) ) return;
        wp_safe_redirect( admin_url( 'admin.php?page=viasetu&tab=connection&welcome=1' ) );
        exit;
    }

    private static function require_admin() {
        if ( ! current_user_can( 'manage_woocommerce' ) ) wp_die( esc_html__( 'You do not have permission to manage ViaSetu.', 'viasetu-woocommerce' ) );
    }

    private static function redirect( $tab, $notice, $type = 'success' ) {
        set_transient( 'viasetu_wc_notice_' . get_current_user_id(), array( 'message' => $notice, 'type' => $type ), 60 );
        wp_safe_redirect( admin_url( 'admin.php?page=viasetu&tab=' . $tab ) );
        exit;
    }

    public static function test_connection() {
        self::require_admin();
        check_admin_referer( 'viasetu_test_connection' );
        $result = ( new ViaSetu_Api_Client() )->wallet();
        if ( is_wp_error( $result ) ) {
            ViaSetu_Logger::log( 'error', 'Connection test failed', array( 'error' => $result->get_error_message() ) );
            self::redirect( 'connection', sprintf( __( 'Connection failed: %s', 'viasetu-woocommerce' ), $result->get_error_message() ), 'error' );
        }
        set_transient( 'viasetu_wc_wallet_' . get_current_user_id(), $result, 5 * MINUTE_IN_SECONDS );
        ViaSetu_Logger::log( 'success', 'Merchant API connection verified' );
        self::redirect( 'connection', __( 'Connected successfully. Merchant wallet access is verified.', 'viasetu-woocommerce' ) );
    }

    public static function sync_now() {
        self::require_admin();
        check_admin_referer( 'viasetu_sync_now' );
        $stats = ViaSetu_Order_Actions::sync_open_shipments();
        self::redirect( 'sync', sprintf( __( 'Sync complete: %1$d checked, %2$d updated, %3$d failed.', 'viasetu-woocommerce' ), $stats['checked'], $stats['updated'], $stats['failed'] ), $stats['failed'] ? 'warning' : 'success' );
    }

    public static function clear_logs() {
        self::require_admin();
        check_admin_referer( 'viasetu_clear_logs' );
        ViaSetu_Logger::clear();
        self::redirect( 'diagnostics', __( 'Diagnostic logs cleared.', 'viasetu-woocommerce' ) );
    }

    private static function tab() {
        $tab = sanitize_key( $_GET['tab'] ?? 'dashboard' );
        return isset( self::$tabs[ $tab ] ) ? $tab : 'dashboard';
    }

    private static function notice() {
        $key    = 'viasetu_wc_notice_' . get_current_user_id();
        $notice = get_transient( $key );
        if ( ! $notice ) return;
        delete_transient( $key );
        $class = 'error' === $notice['type'] ? 'notice-error' : ( 'warning' === $notice['type'] ? 'notice-warning' : 'notice-success' );
        echo '<div class="notice ' . esc_attr( $class ) . ' is-dismissible"><p>' . esc_html( $notice['message'] ) . '</p></div>';
    }

    public static function render() {
        self::require_admin();
        $tab = self::tab();
        echo '<div class="wrap viasetu-admin">';
        self::notice();
        settings_errors( ViaSetu_Settings::OPTION );
        echo '<section class="viasetu-hero"><div><span class="viasetu-badge">ViaSetu for WooCommerce · v' . esc_html( VIASETU_WC_VERSION ) . '</span><h1>' . esc_html__( 'Shipping operations, inside WooCommerce.', 'viasetu-woocommerce' ) . '</h1><p>' . esc_html__( 'Connect one merchant account, control checkout rates and keep every order in sync.', 'viasetu-woocommerce' ) . '</p></div><div class="viasetu-actions"><a class="button button-primary" href="' . esc_url( admin_url( 'admin.php?page=viasetu&tab=connection' ) ) . '">' . esc_html__( 'Setup connection', 'viasetu-woocommerce' ) . '</a><a class="button" target="_blank" rel="noopener" href="https://www.viasetu.com/viasetuforbusinesses/developers">' . esc_html__( 'Merchant console', 'viasetu-woocommerce' ) . '</a></div></section>';
        echo '<nav class="viasetu-tabs" aria-label="ViaSetu settings">';
        foreach ( self::$tabs as $key => $label ) echo '<a class="' . esc_attr( $key === $tab ? 'active' : '' ) . '" href="' . esc_url( admin_url( 'admin.php?page=viasetu&tab=' . $key ) ) . '">' . esc_html( $label ) . '</a>';
        echo '</nav>';
        if ( 'dashboard' === $tab ) self::dashboard();
        elseif ( 'connection' === $tab ) self::connection();
        elseif ( 'shipping' === $tab ) self::shipping();
        elseif ( 'products' === $tab ) self::products();
        elseif ( 'sync' === $tab ) self::sync();
        else self::diagnostics();
        echo '</div>';
    }

    private static function connection_ready() {
        return '' !== ViaSetu_Settings::api_key() && '' !== ViaSetu_Settings::get( 'pickup_pincode' );
    }

    private static function order_count( $with_booking = true ) {
        $args = array( 'limit' => 1, 'paginate' => true, 'return' => 'ids' );
        if ( $with_booking ) {
            $args['meta_key']     = '_viasetu_booking_id';
            $args['meta_compare'] = 'EXISTS';
        }
        $result = wc_get_orders( $args );
        return is_object( $result ) && isset( $result->total ) ? (int) $result->total : 0;
    }

    private static function dashboard() {
        $scheduled = wp_next_scheduled( 'viasetu_wc_tracking_sync' );
        echo '<div class="viasetu-grid">';
        self::stat_card( __( 'Connection', 'viasetu-woocommerce' ), self::connection_ready() ? __( 'Configured', 'viasetu-woocommerce' ) : __( 'Setup required', 'viasetu-woocommerce' ), self::connection_ready() ? 'good' : 'warn' );
        self::stat_card( __( 'ViaSetu shipments', 'viasetu-woocommerce' ), number_format_i18n( self::order_count() ), '' );
        self::stat_card( __( 'Background sync', 'viasetu-woocommerce' ), $scheduled ? human_time_diff( time(), $scheduled ) : __( 'Not scheduled', 'viasetu-woocommerce' ), $scheduled ? 'good' : 'bad' );
        self::stat_card( __( 'Checkout rates', 'viasetu-woocommerce' ), 'yes' === ViaSetu_Settings::get( 'enabled' ) ? __( 'Enabled', 'viasetu-woocommerce' ) : __( 'Disabled', 'viasetu-woocommerce' ), 'yes' === ViaSetu_Settings::get( 'enabled' ) ? 'good' : 'warn' );
        echo '<section class="viasetu-card full"><h2>' . esc_html__( 'Setup checklist', 'viasetu-woocommerce' ) . '</h2><ul class="viasetu-checklist">';
        self::check_item( __( 'Merchant API key saved securely', 'viasetu-woocommerce' ), '' !== ViaSetu_Settings::api_key() );
        self::check_item( __( 'Pickup address and pincode configured', 'viasetu-woocommerce' ), '' !== ViaSetu_Settings::get( 'pickup_address' ) && 6 === strlen( ViaSetu_Settings::get( 'pickup_pincode' ) ) );
        self::check_item( __( 'ViaSetu added to a WooCommerce shipping zone', 'viasetu-woocommerce' ), self::shipping_zone_ready() );
        self::check_item( __( 'Webhook signing secret configured', 'viasetu-woocommerce' ), '' !== ViaSetu_Settings::webhook_secret() );
        echo '</ul></section>';
        self::recent_shipments();
        echo '</div>';
    }

    private static function stat_card( $label, $value, $tone ) {
        echo '<section class="viasetu-card third"><div>' . esc_html( $label ) . '</div><div class="viasetu-stat viasetu-' . esc_attr( $tone ) . '">' . esc_html( $value ) . '</div></section>';
    }

    private static function check_item( $label, $done ) {
        echo '<li><span>' . esc_html( $label ) . '</span><strong class="viasetu-' . esc_attr( $done ? 'good' : 'warn' ) . '">' . esc_html( $done ? __( 'Complete', 'viasetu-woocommerce' ) : __( 'Action needed', 'viasetu-woocommerce' ) ) . '</strong></li>';
    }

    private static function shipping_zone_ready() {
        if ( ! class_exists( 'WC_Shipping_Zones' ) ) return false;
        foreach ( WC_Shipping_Zones::get_zones() as $zone ) {
            foreach ( $zone['shipping_methods'] ?? array() as $method ) if ( 'viasetu_shipping' === $method->id && 'yes' === $method->enabled ) return true;
        }
        $rest = new WC_Shipping_Zone( 0 );
        foreach ( $rest->get_shipping_methods() as $method ) if ( 'viasetu_shipping' === $method->id && 'yes' === $method->enabled ) return true;
        return false;
    }

    private static function recent_shipments() {
        $orders = wc_get_orders(
            array(
                'limit'        => 10,
                'orderby'      => 'date',
                'order'        => 'DESC',
                'meta_key'     => '_viasetu_booking_id',
                'meta_compare' => 'EXISTS',
            )
        );
        echo '<section class="viasetu-card full"><div class="viasetu-actions"><h2 style="margin-right:auto">' . esc_html__( 'Recent ViaSetu shipments', 'viasetu-woocommerce' ) . '</h2><a class="button" href="' . esc_url( admin_url( 'edit.php?post_type=shop_order' ) ) . '">' . esc_html__( 'All orders', 'viasetu-woocommerce' ) . '</a></div><table class="widefat striped"><thead><tr><th>' . esc_html__( 'Order', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Customer', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'AWB', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Shipment status', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Total', 'viasetu-woocommerce' ) . '</th></tr></thead><tbody>';
        if ( ! $orders ) echo '<tr><td colspan="5">' . esc_html__( 'No ViaSetu shipments have been created yet.', 'viasetu-woocommerce' ) . '</td></tr>';
        foreach ( $orders as $order ) {
            echo '<tr><td><a href="' . esc_url( $order->get_edit_order_url() ) . '">#' . esc_html( $order->get_order_number() ) . '</a></td><td>' . esc_html( $order->get_formatted_billing_full_name() ) . '</td><td>' . esc_html( $order->get_meta( '_viasetu_awb' ) ?: 'Pending' ) . '</td><td>' . esc_html( $order->get_meta( '_viasetu_status' ) ?: 'Created' ) . '</td><td>' . wp_kses_post( $order->get_formatted_order_total() ) . '</td></tr>';
        }
        echo '</tbody></table></section>';
    }

    private static function form_start( $section ) {
        echo '<form method="post" action="options.php">';
        settings_fields( 'viasetu_wc' );
        echo '<input type="hidden" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[_section]" value="' . esc_attr( $section ) . '">';
    }

    private static function connection() {
        $s      = ViaSetu_Settings::get_all();
        $wallet = get_transient( 'viasetu_wc_wallet_' . get_current_user_id() );
        echo '<div class="viasetu-grid"><section class="viasetu-card"><h2>' . esc_html__( 'Connect merchant account', 'viasetu-woocommerce' ) . '</h2><p>' . esc_html__( 'Use the merchant console to create a dedicated WooCommerce key, then save it here. Your ViaSetu password is never entered into WordPress.', 'viasetu-woocommerce' ) . '</p><div class="viasetu-actions"><a class="button button-primary" target="_blank" rel="noopener" href="https://www.viasetu.com/viasetuforbusinesses/developers">' . esc_html__( 'Sign in to ViaSetu', 'viasetu-woocommerce' ) . '</a><a class="button" target="_blank" rel="noopener" href="https://www.viasetu.com/developers/merchant-api">' . esc_html__( 'API documentation', 'viasetu-woocommerce' ) . '</a></div><p class="description">' . esc_html__( 'Recommended scopes: rates:read, shipments:read, shipments:write and wallet:read.', 'viasetu-woocommerce' ) . '</p></section>';
        echo '<section class="viasetu-card"><h2>' . esc_html__( 'Connection status', 'viasetu-woocommerce' ) . '</h2><p class="viasetu-stat ' . esc_attr( ViaSetu_Settings::api_key() ? 'viasetu-good' : 'viasetu-warn' ) . '">' . esc_html( ViaSetu_Settings::api_key() ? __( 'Key configured', 'viasetu-woocommerce' ) : __( 'Not connected', 'viasetu-woocommerce' ) ) . '</p>';
        if ( is_array( $wallet ) ) echo '<p>' . esc_html__( 'Wallet balance:', 'viasetu-woocommerce' ) . ' <strong>₹' . esc_html( number_format_i18n( (float) ( $wallet['balance'] ?? 0 ), 2 ) ) . '</strong></p>';
        echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="viasetu_test_connection">'; wp_nonce_field( 'viasetu_test_connection' ); submit_button( __( 'Test connection', 'viasetu-woocommerce' ), 'secondary', 'submit', false ); echo '</form></section>';
        echo '<section class="viasetu-card full"><h2>' . esc_html__( 'API-key connection', 'viasetu-woocommerce' ) . '</h2>';
        self::form_start( 'connection' );
        echo '<table class="form-table viasetu-form-table"><tr><th>' . esc_html__( 'Integration', 'viasetu-woocommerce' ) . '</th><td><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[enabled]" ' . checked( $s['enabled'], 'yes', false ) . '> ' . esc_html__( 'Enable ViaSetu checkout and order tools', 'viasetu-woocommerce' ) . '</label></td></tr>';
        echo '<tr><th>' . esc_html__( 'Connection method', 'viasetu-woocommerce' ) . '</th><td><select name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[connection_mode]"><option value="api_key" ' . selected( $s['connection_mode'], 'api_key', false ) . '>' . esc_html__( 'Dedicated API key', 'viasetu-woocommerce' ) . '</option><option value="portal" ' . selected( $s['connection_mode'], 'portal', false ) . '>' . esc_html__( 'Merchant console assisted setup', 'viasetu-woocommerce' ) . '</option></select></td></tr>';
        echo '<tr><th>' . esc_html__( 'Merchant API key', 'viasetu-woocommerce' ) . '</th><td><input class="regular-text" type="password" autocomplete="new-password" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[api_key]" placeholder="' . esc_attr( ViaSetu_Settings::api_key() ? 'Configured — enter a new key to replace' : 'vs_live_…' ) . '"><p class="description">' . esc_html__( 'Encrypted before storage. Leave blank to keep the current key.', 'viasetu-woocommerce' ) . '</p></td></tr>';
        echo '<tr><th>' . esc_html__( 'API endpoint', 'viasetu-woocommerce' ) . '</th><td><input class="large-text code" type="url" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[api_endpoint]" value="' . esc_attr( $s['api_endpoint'] ) . '"></td></tr>';
        echo '<tr><th>' . esc_html__( 'Webhook signing secret', 'viasetu-woocommerce' ) . '</th><td><input class="regular-text" type="password" autocomplete="new-password" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[webhook_secret]" placeholder="' . esc_attr( ViaSetu_Settings::webhook_secret() ? 'Configured — enter a new secret to replace' : '' ) . '"><p class="viasetu-code">' . esc_html( rest_url( 'viasetu/v1/webhook' ) ) . '</p></td></tr></table>';
        submit_button( __( 'Save connection', 'viasetu-woocommerce' ) ); echo '</form></section></div>';
    }

    private static function shipping() {
        $s = ViaSetu_Settings::get_all();
        echo '<div class="viasetu-grid"><section class="viasetu-card full"><h2>' . esc_html__( 'Pickup, rates and checkout', 'viasetu-woocommerce' ) . '</h2><p class="viasetu-notice">' . esc_html__( 'After saving, add “ViaSetu Shipping” to every WooCommerce shipping zone where it should appear.', 'viasetu-woocommerce' ) . '</p>';
        self::form_start( 'shipping' );
        echo '<table class="form-table viasetu-form-table"><tr><th>' . esc_html__( 'Pickup address', 'viasetu-woocommerce' ) . '</th><td>';
        foreach ( array( 'pickup_name' => 'Contact name', 'pickup_phone' => 'Phone', 'pickup_address' => 'Address', 'pickup_city' => 'City', 'pickup_state' => 'State', 'pickup_pincode' => 'Pincode' ) as $field => $label ) echo '<p><label>' . esc_html( $label ) . '<br><input class="regular-text" type="text" name="' . esc_attr( ViaSetu_Settings::OPTION . '[' . $field . ']' ) . '" value="' . esc_attr( $s[ $field ] ) . '"></label></p>';
        echo '</td></tr><tr><th>' . esc_html__( 'Checkout label', 'viasetu-woocommerce' ) . '</th><td><input class="regular-text" type="text" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[shipping_title]" value="' . esc_attr( $s['shipping_title'] ) . '"></td></tr>';
        echo '<tr><th>' . esc_html__( 'Default goods type', 'viasetu-woocommerce' ) . '</th><td><input class="regular-text" type="text" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[default_goods_type]" value="' . esc_attr( $s['default_goods_type'] ) . '"></td></tr>';
        echo '<tr><th>' . esc_html__( 'Fallback parcel size', 'viasetu-woocommerce' ) . '</th><td>'; foreach ( array( 'default_length' => 'L', 'default_width' => 'W', 'default_height' => 'H' ) as $field => $label ) echo '<label>' . esc_html( $label ) . ' <input class="small-text" type="number" min="1" max="300" name="' . esc_attr( ViaSetu_Settings::OPTION . '[' . $field . ']' ) . '" value="' . esc_attr( $s[ $field ] ) . '"></label> &nbsp;'; echo '</td></tr>';
        echo '<tr><th>' . esc_html__( 'Rate priority', 'viasetu-woocommerce' ) . '</th><td><select name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[quote_sort]"><option value="price" ' . selected( $s['quote_sort'], 'price', false ) . '>' . esc_html__( 'Lowest price first', 'viasetu-woocommerce' ) . '</option><option value="fastest" ' . selected( $s['quote_sort'], 'fastest', false ) . '>' . esc_html__( 'Fastest first', 'viasetu-woocommerce' ) . '</option><option value="preferred" ' . selected( $s['quote_sort'], 'preferred', false ) . '>' . esc_html__( 'Preferred couriers first', 'viasetu-woocommerce' ) . '</option></select></td></tr>';
        echo '<tr><th>' . esc_html__( 'Preferred courier codes', 'viasetu-woocommerce' ) . '</th><td><input class="regular-text" type="text" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[preferred_partners]" value="' . esc_attr( $s['preferred_partners'] ) . '" placeholder="delhivery, xpressbees"><p class="description">' . esc_html__( 'Comma-separated; used only with Preferred couriers priority.', 'viasetu-woocommerce' ) . '</p></td></tr>';
        echo '<tr><th>' . esc_html__( 'Checkout choices', 'viasetu-woocommerce' ) . '</th><td><label>' . esc_html__( 'Maximum quotes', 'viasetu-woocommerce' ) . ' <input class="small-text" type="number" min="1" max="5" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[max_quotes]" value="' . esc_attr( $s['max_quotes'] ) . '"></label><p><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[show_courier]" ' . checked( $s['show_courier'], 'yes', false ) . '> ' . esc_html__( 'Show courier name', 'viasetu-woocommerce' ) . '</label></p><p><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[show_eta]" ' . checked( $s['show_eta'], 'yes', false ) . '> ' . esc_html__( 'Show delivery estimate', 'viasetu-woocommerce' ) . '</label></p><p><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[enable_cod]" ' . checked( $s['enable_cod'], 'yes', false ) . '> ' . esc_html__( 'Allow WooCommerce Cash on Delivery with ViaSetu rates', 'viasetu-woocommerce' ) . '</label></p></td></tr>';
        echo '<tr><th>' . esc_html__( 'Fallback rate', 'viasetu-woocommerce' ) . '</th><td><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[fallback_enabled]" ' . checked( $s['fallback_enabled'], 'yes', false ) . '> ' . esc_html__( 'Offer fallback when live rates are unavailable', 'viasetu-woocommerce' ) . '</label> <input class="small-text" type="number" min="0" step="0.01" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[fallback_cost]" value="' . esc_attr( $s['fallback_cost'] ) . '"> ₹</td></tr></table>';
        submit_button( __( 'Save shipping rules', 'viasetu-woocommerce' ) ); echo '</form></section></div>';
    }

    private static function products() {
        echo '<div class="viasetu-grid"><section class="viasetu-card"><h2>' . esc_html__( 'Product shipping data', 'viasetu-woocommerce' ) . '</h2><p>' . esc_html__( 'ViaSetu uses each product’s WooCommerce weight and dimensions. Complete these fields for accurate live quotes.', 'viasetu-woocommerce' ) . '</p><a class="button button-primary" href="' . esc_url( admin_url( 'edit.php?post_type=product' ) ) . '">' . esc_html__( 'Manage products', 'viasetu-woocommerce' ) . '</a></section><section class="viasetu-card"><h2>' . esc_html__( 'Per-product controls', 'viasetu-woocommerce' ) . '</h2><ul class="viasetu-checklist"><li>' . esc_html__( 'Exclude a product from ViaSetu checkout', 'viasetu-woocommerce' ) . '</li><li>' . esc_html__( 'Set a shipment goods type', 'viasetu-woocommerce' ) . '</li><li>' . esc_html__( 'Mark fragile products for merchant handling', 'viasetu-woocommerce' ) . '</li></ul><p class="description">' . esc_html__( 'Open a product and use Product data → Shipping.', 'viasetu-woocommerce' ) . '</p></section></div>';
    }

    private static function sync() {
        $s = ViaSetu_Settings::get_all();
        echo '<div class="viasetu-grid"><section class="viasetu-card"><h2>' . esc_html__( 'Run shipment sync', 'viasetu-woocommerce' ) . '</h2><p>' . esc_html__( 'Refresh open ViaSetu shipments now. Scheduled sync continues in the background.', 'viasetu-woocommerce' ) . '</p><form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="viasetu_sync_now">'; wp_nonce_field( 'viasetu_sync_now' ); submit_button( __( 'Sync now', 'viasetu-woocommerce' ), 'primary', 'submit', false ); echo '</form></section><section class="viasetu-card"><h2>' . esc_html__( 'Webhook receiver', 'viasetu-woocommerce' ) . '</h2><code class="viasetu-code">' . esc_html( rest_url( 'viasetu/v1/webhook' ) ) . '</code><p>' . esc_html__( 'Configure this target URL and the same signing secret in the ViaSetu merchant console.', 'viasetu-woocommerce' ) . '</p></section>';
        echo '<section class="viasetu-card full"><h2>' . esc_html__( 'Automation rules', 'viasetu-woocommerce' ) . '</h2>'; self::form_start( 'sync' );
        echo '<table class="form-table viasetu-form-table"><tr><th>' . esc_html__( 'Automatic booking', 'viasetu-woocommerce' ) . '</th><td><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[auto_create]" ' . checked( $s['auto_create'], 'yes', false ) . '> ' . esc_html__( 'Create a shipment when an order enters a selected status', 'viasetu-woocommerce' ) . '</label><fieldset>';
        foreach ( array( 'pending' => 'Pending payment', 'on-hold' => 'On hold', 'processing' => 'Processing', 'completed' => 'Completed' ) as $status => $label ) echo '<label style="margin-right:16px"><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[auto_create_statuses][]" value="' . esc_attr( $status ) . '" ' . checked( in_array( $status, (array) $s['auto_create_statuses'], true ), true, false ) . '> ' . esc_html( $label ) . '</label>';
        echo '</fieldset></td></tr><tr><th>' . esc_html__( 'Tracking schedule', 'viasetu-woocommerce' ) . '</th><td><select name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[sync_interval]"><option value="viasetu_15_minutes" ' . selected( $s['sync_interval'], 'viasetu_15_minutes', false ) . '>' . esc_html__( 'Every 15 minutes', 'viasetu-woocommerce' ) . '</option><option value="hourly" ' . selected( $s['sync_interval'], 'hourly', false ) . '>' . esc_html__( 'Hourly', 'viasetu-woocommerce' ) . '</option><option value="twicedaily" ' . selected( $s['sync_interval'], 'twicedaily', false ) . '>' . esc_html__( 'Twice daily', 'viasetu-woocommerce' ) . '</option></select> &nbsp; <label>' . esc_html__( 'Orders per run', 'viasetu-woocommerce' ) . ' <input class="small-text" type="number" min="10" max="200" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[sync_batch_size]" value="' . esc_attr( $s['sync_batch_size'] ) . '"></label></td></tr><tr><th>' . esc_html__( 'Status behavior', 'viasetu-woocommerce' ) . '</th><td><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[complete_when_delivered]" ' . checked( $s['complete_when_delivered'], 'yes', false ) . '> ' . esc_html__( 'Mark WooCommerce order Completed after ViaSetu delivery', 'viasetu-woocommerce' ) . '</label></td></tr><tr><th>' . esc_html__( 'Logging', 'viasetu-woocommerce' ) . '</th><td><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[debug_logging]" ' . checked( $s['debug_logging'], 'yes', false ) . '> ' . esc_html__( 'Enable diagnostic debug logs (credentials are always redacted)', 'viasetu-woocommerce' ) . '</label></td></tr></table>';
        submit_button( __( 'Save automation', 'viasetu-woocommerce' ) ); echo '</form></section></div>';
    }

    private static function diagnostics() {
        $checks = array(
            array( 'WordPress HTTPS', is_ssl(), home_url() ),
            array( 'WooCommerce', defined( 'WC_VERSION' ) && version_compare( WC_VERSION, '8.0', '>=' ), defined( 'WC_VERSION' ) ? WC_VERSION : 'Missing' ),
            array( 'PHP 7.4+', version_compare( PHP_VERSION, '7.4', '>=' ), PHP_VERSION ),
            array( 'Secret encryption', function_exists( 'sodium_crypto_secretbox' ) || function_exists( 'openssl_encrypt' ), function_exists( 'sodium_crypto_secretbox' ) ? 'Sodium' : ( function_exists( 'openssl_encrypt' ) ? 'OpenSSL' : 'Unavailable' ) ),
            array( 'WP-Cron sync', (bool) wp_next_scheduled( 'viasetu_wc_tracking_sync' ), wp_next_scheduled( 'viasetu_wc_tracking_sync' ) ? wp_date( 'Y-m-d H:i:s', wp_next_scheduled( 'viasetu_wc_tracking_sync' ) ) : 'Not scheduled' ),
        );
        echo '<div class="viasetu-grid"><section class="viasetu-card full"><h2>' . esc_html__( 'System health', 'viasetu-woocommerce' ) . '</h2><ul class="viasetu-checklist">'; foreach ( $checks as $check ) echo '<li><span>' . esc_html( $check[0] ) . '<br><small>' . esc_html( $check[2] ) . '</small></span><strong class="viasetu-' . esc_attr( $check[1] ? 'good' : 'bad' ) . '">' . esc_html( $check[1] ? 'Pass' : 'Check' ) . '</strong></li>'; echo '</ul></section><section class="viasetu-card full"><div class="viasetu-actions"><h2 style="margin-right:auto">' . esc_html__( 'Recent integration logs', 'viasetu-woocommerce' ) . '</h2><form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="viasetu_clear_logs">'; wp_nonce_field( 'viasetu_clear_logs' ); submit_button( __( 'Clear logs', 'viasetu-woocommerce' ), 'secondary', 'submit', false ); echo '</form></div><table class="viasetu-log"><thead><tr><th>' . esc_html__( 'Time', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Level', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Message', 'viasetu-woocommerce' ) . '</th></tr></thead><tbody>';
        $logs = ViaSetu_Logger::all();
        if ( ! $logs ) echo '<tr><td colspan="3">' . esc_html__( 'No integration events recorded yet.', 'viasetu-woocommerce' ) . '</td></tr>';
        foreach ( array_slice( $logs, 0, 30 ) as $log ) echo '<tr><td>' . esc_html( $log['time'] ?? '' ) . '</td><td class="viasetu-level-' . esc_attr( $log['level'] ?? 'info' ) . '">' . esc_html( strtoupper( $log['level'] ?? 'info' ) ) . '</td><td>' . esc_html( $log['message'] ?? '' ) . '</td></tr>';
        echo '</tbody></table></section></div>';
    }
}
