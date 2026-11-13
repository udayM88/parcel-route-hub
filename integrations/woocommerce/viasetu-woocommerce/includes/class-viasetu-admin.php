<?php
defined( 'ABSPATH' ) || exit;

final class ViaSetu_Admin {
    private static $tabs = array(
        'dashboard'   => 'Overview',
        'orders'      => 'Orders',
        'shipments'   => 'Shipments',
        'billing'     => 'Billing',
        'labels'      => 'Labels',
        'shipping'    => 'Shipping',
        'sync'        => 'Automation',
        'products'    => 'Products',
        'connection'  => 'Connection',
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
        add_menu_page(
            __( 'ViaSetu Merchant', 'viasetu-woocommerce' ),
            __( 'ViaSetu Merchant', 'viasetu-woocommerce' ),
            'manage_woocommerce',
            'viasetu',
            array( __CLASS__, 'render' ),
            'dashicons-location-alt',
            56
        );
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
        if ( ! current_user_can( 'manage_woocommerce' ) ) {
            wp_die( esc_html__( 'You do not have permission to manage ViaSetu.', 'viasetu-woocommerce' ) );
        }
    }

    private static function redirect( $tab, $notice, $type = 'success' ) {
        set_transient( 'viasetu_wc_notice_' . get_current_user_id(), array( 'message' => $notice, 'type' => $type ), 60 );
        wp_safe_redirect( admin_url( 'admin.php?page=viasetu&tab=' . sanitize_key( $tab ) ) );
        exit;
    }

    public static function test_connection() {
        self::require_admin();
        check_admin_referer( 'viasetu_test_connection' );
        $result = ( new ViaSetu_Api_Client() )->account();
        if ( is_wp_error( $result ) ) {
            ViaSetu_Logger::log( 'error', 'Connection test failed', array( 'error' => $result->get_error_message() ) );
            self::redirect( 'connection', sprintf( __( 'Connection failed: %s', 'viasetu-woocommerce' ), $result->get_error_message() ), 'error' );
        }
        set_transient( 'viasetu_wc_account_' . get_current_user_id(), $result, 5 * MINUTE_IN_SECONDS );
        ViaSetu_Logger::log( 'success', 'Merchant API connection verified' );
        self::redirect( 'connection', __( 'Connection verified. Merchant account and wallet access are working.', 'viasetu-woocommerce' ) );
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
        $tab = sanitize_key( wp_unslash( $_GET['tab'] ?? 'dashboard' ) );
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
        $tab       = self::tab();
        $connected = ViaSetu_Settings::is_connected();
        $demo      = defined( 'VIASETU_WC_DEMO_MODE' ) && VIASETU_WC_DEMO_MODE;

        echo '<div class="wrap viasetu-admin">';
        self::notice();
        settings_errors( ViaSetu_Settings::OPTION );
        echo '<header class="viasetu-hero"><div class="viasetu-brand"><span class="viasetu-mark" aria-hidden="true">VS</span><div><p>ViaSetu Merchant</p><span>WooCommerce operations workspace</span></div></div>';
        echo '<div class="viasetu-hero-status"><span class="viasetu-status-dot ' . esc_attr( $connected ? 'is-online' : '' ) . '"></span><strong>' . esc_html( $connected ? __( 'Connected', 'viasetu-woocommerce' ) : __( 'Setup required', 'viasetu-woocommerce' ) ) . '</strong>';
        echo '<span class="viasetu-mode">' . esc_html( $demo ? __( 'Sandbox demo', 'viasetu-woocommerce' ) : strtoupper( ViaSetu_Settings::get( 'environment', 'live' ) ) ) . '</span></div></header>';

        echo '<div class="viasetu-shell"><nav class="viasetu-tabs" aria-label="' . esc_attr__( 'ViaSetu Merchant sections', 'viasetu-woocommerce' ) . '">';
        foreach ( self::$tabs as $key => $label ) {
            echo '<a class="' . esc_attr( $key === $tab ? 'active' : '' ) . '" href="' . esc_url( admin_url( 'admin.php?page=viasetu&tab=' . $key ) ) . '"><span class="dashicons ' . esc_attr( self::tab_icon( $key ) ) . '"></span>' . esc_html( $label ) . '</a>';
        }
        echo '</nav><main class="viasetu-workspace">';

        if ( ! $connected && ! in_array( $tab, array( 'connection', 'diagnostics' ), true ) ) {
            echo '<section class="viasetu-empty"><span class="dashicons dashicons-admin-links"></span><h2>' . esc_html__( 'Connect your ViaSetu merchant account', 'viasetu-woocommerce' ) . '</h2><p>' . esc_html__( 'Approve this store once to unlock orders, billing, rates, labels and signed tracking updates inside WordPress.', 'viasetu-woocommerce' ) . '</p><a class="button button-primary" href="' . esc_url( admin_url( 'admin.php?page=viasetu&tab=connection' ) ) . '">' . esc_html__( 'Open secure connection', 'viasetu-woocommerce' ) . '</a></section>';
        } elseif ( 'dashboard' === $tab ) self::dashboard();
        elseif ( 'orders' === $tab ) self::orders();
        elseif ( 'shipments' === $tab ) self::shipments();
        elseif ( 'billing' === $tab ) self::billing();
        elseif ( 'labels' === $tab ) self::labels();
        elseif ( 'shipping' === $tab ) self::shipping();
        elseif ( 'sync' === $tab ) self::sync();
        elseif ( 'products' === $tab ) self::products();
        elseif ( 'connection' === $tab ) self::connection();
        else self::diagnostics();

        echo '</main></div></div>';
    }

    private static function tab_icon( $tab ) {
        $icons = array(
            'dashboard' => 'dashicons-chart-area', 'orders' => 'dashicons-list-view', 'shipments' => 'dashicons-archive',
            'billing' => 'dashicons-money-alt', 'labels' => 'dashicons-media-document', 'shipping' => 'dashicons-location-alt',
            'sync' => 'dashicons-update', 'products' => 'dashicons-products', 'connection' => 'dashicons-admin-links',
            'diagnostics' => 'dashicons-shield-alt',
        );
        return $icons[ $tab ] ?? 'dashicons-admin-generic';
    }

    private static function api( $action, $payload = array(), $ttl = 45 ) {
        $cache_key = 'viasetu_wc_api_' . md5( $action . wp_json_encode( $payload ) . get_current_user_id() );
        if ( empty( $_GET['refresh'] ) ) {
            $cached = get_transient( $cache_key );
            if ( false !== $cached ) return $cached;
        }
        $result = ( new ViaSetu_Api_Client() )->request( $action, $payload );
        if ( ! is_wp_error( $result ) ) set_transient( $cache_key, $result, $ttl );
        return $result;
    }

    private static function page_heading( $title, $description, $action = '' ) {
        echo '<div class="viasetu-page-heading"><div><h1>' . esc_html( $title ) . '</h1><p>' . esc_html( $description ) . '</p></div>' . $action . '</div>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- generated internally with escaped URLs.
    }

    private static function money( $amount ) {
        return '₹' . number_format_i18n( (float) $amount, 2 );
    }

    private static function status_badge( $status ) {
        $status = strtoupper( sanitize_text_field( $status ?: 'PENDING' ) );
        $tone   = in_array( $status, array( 'DELIVERED', 'COMPLETED' ), true ) ? 'good' : ( in_array( $status, array( 'FAILED', 'CANCELLED', 'RTO', 'UNDELIVERED' ), true ) ? 'bad' : 'info' );
        return '<span class="viasetu-pill viasetu-pill-' . esc_attr( $tone ) . '">' . esc_html( ucwords( strtolower( str_replace( '_', ' ', $status ) ) ) ) . '</span>';
    }

    private static function dashboard() {
        $data = self::api( 'dashboard' );
        self::page_heading( __( 'Operations overview', 'viasetu-woocommerce' ), __( 'Live merchant activity and WooCommerce fulfilment health in one place.', 'viasetu-woocommerce' ), '<a class="button" href="' . esc_url( admin_url( 'admin.php?page=viasetu&tab=dashboard&refresh=1' ) ) . '">' . esc_html__( 'Refresh', 'viasetu-woocommerce' ) . '</a>' );
        if ( is_wp_error( $data ) ) { self::api_error( $data ); return; }
        $metrics = $data['metrics'] ?? array();
        $wallet  = $data['wallet'] ?? array();
        echo '<div class="viasetu-metric-grid">';
        self::metric( __( 'All shipments', 'viasetu-woocommerce' ), $metrics['total_shipments'] ?? 0, 'dashicons-archive', '' );
        self::metric( __( 'In progress', 'viasetu-woocommerce' ), $metrics['active_shipments'] ?? 0, 'dashicons-controls-repeat', 'info' );
        self::metric( __( 'Delivered', 'viasetu-woocommerce' ), $metrics['delivered_shipments'] ?? 0, 'dashicons-yes-alt', 'good' );
        self::metric( __( 'Needs attention', 'viasetu-woocommerce' ), $metrics['exceptions'] ?? 0, 'dashicons-warning', 'warn' );
        self::metric( __( 'Wallet balance', 'viasetu-woocommerce' ), self::money( $wallet['balance'] ?? 0 ), 'dashicons-money-alt', (float) ( $wallet['balance'] ?? 0 ) <= (float) ( $wallet['low_balance_threshold'] ?? 0 ) ? 'warn' : 'good' );
        echo '</div>';

        echo '<div class="viasetu-grid"><section class="viasetu-card full"><div class="viasetu-card-head"><div><h2>' . esc_html__( 'Recent merchant orders', 'viasetu-woocommerce' ) . '</h2><p>' . esc_html__( 'Orders booked against this ViaSetu merchant account.', 'viasetu-woocommerce' ) . '</p></div><a class="button" href="' . esc_url( admin_url( 'admin.php?page=viasetu&tab=orders' ) ) . '">' . esc_html__( 'View all', 'viasetu-woocommerce' ) . '</a></div>';
        self::merchant_orders_table( $data['recent_orders'] ?? array() );
        echo '</section><section class="viasetu-card"><h2>' . esc_html__( 'Store readiness', 'viasetu-woocommerce' ) . '</h2><ul class="viasetu-checklist">';
        self::check_item( __( 'Merchant key stored encrypted', 'viasetu-woocommerce' ), '' !== ViaSetu_Settings::api_key() );
        self::check_item( __( 'Pickup address configured', 'viasetu-woocommerce' ), '' !== ViaSetu_Settings::get( 'pickup_address' ) && 6 === strlen( ViaSetu_Settings::get( 'pickup_pincode' ) ) );
        self::check_item( __( 'WooCommerce shipping zone enabled', 'viasetu-woocommerce' ), self::shipping_zone_ready() );
        self::check_item( __( 'Signed webhook secret active', 'viasetu-woocommerce' ), '' !== ViaSetu_Settings::webhook_secret() );
        echo '</ul></section>';

        $scheduled = wp_next_scheduled( 'viasetu_wc_tracking_sync' );
        echo '<section class="viasetu-card"><h2>' . esc_html__( 'Automation status', 'viasetu-woocommerce' ) . '</h2><dl class="viasetu-details"><div><dt>' . esc_html__( 'Tracking sync', 'viasetu-woocommerce' ) . '</dt><dd>' . esc_html( $scheduled ? wp_date( 'd M, H:i', $scheduled ) : __( 'Not scheduled', 'viasetu-woocommerce' ) ) . '</dd></div><div><dt>' . esc_html__( 'Automatic booking', 'viasetu-woocommerce' ) . '</dt><dd>' . esc_html( 'yes' === ViaSetu_Settings::get( 'auto_create' ) ? __( 'Enabled', 'viasetu-woocommerce' ) : __( 'Manual', 'viasetu-woocommerce' ) ) . '</dd></div><div><dt>' . esc_html__( 'Checkout rates', 'viasetu-woocommerce' ) . '</dt><dd>' . esc_html( 'yes' === ViaSetu_Settings::get( 'enabled' ) ? __( 'Enabled', 'viasetu-woocommerce' ) : __( 'Disabled', 'viasetu-woocommerce' ) ) . '</dd></div></dl><a class="button" href="' . esc_url( admin_url( 'admin.php?page=viasetu&tab=sync' ) ) . '">' . esc_html__( 'Manage automation', 'viasetu-woocommerce' ) . '</a></section></div>';
    }

    private static function metric( $label, $value, $icon, $tone ) {
        echo '<section class="viasetu-metric ' . esc_attr( $tone ? 'is-' . $tone : '' ) . '"><span class="dashicons ' . esc_attr( $icon ) . '"></span><div><p>' . esc_html( $label ) . '</p><strong>' . esc_html( $value ) . '</strong></div></section>';
    }

    private static function merchant_orders_table( $orders ) {
        echo '<div class="viasetu-table-wrap"><table class="viasetu-table"><thead><tr><th>' . esc_html__( 'Shipment', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Customer', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Courier', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Status', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Amount', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Created', 'viasetu-woocommerce' ) . '</th></tr></thead><tbody>';
        if ( empty( $orders ) ) echo '<tr><td colspan="6" class="viasetu-table-empty">' . esc_html__( 'No merchant shipments yet.', 'viasetu-woocommerce' ) . '</td></tr>';
        foreach ( (array) $orders as $order ) {
            $awb = $order['prayog_awb'] ?? $order['tracking_id'] ?? '';
            echo '<tr><td><strong>' . esc_html( $awb ?: substr( (string) ( $order['id'] ?? '' ), 0, 12 ) ) . '</strong><small>' . esc_html( strtoupper( $order['booking_source'] ?? 'merchant' ) ) . '</small></td><td>' . esc_html( $order['receiver_name'] ?? '—' ) . '<small>' . esc_html( trim( ( $order['receiver_city'] ?? '' ) . ' ' . ( $order['receiver_pincode'] ?? '' ) ) ) . '</small></td><td>' . esc_html( $order['courier_name'] ?? '—' ) . '<small>' . esc_html( $order['delivery_time'] ?? '' ) . '</small></td><td>' . self::status_badge( $order['status'] ?? '' ) . '</td><td>' . esc_html( self::money( $order['courier_price'] ?? 0 ) ) . '</td><td>' . esc_html( ! empty( $order['created_at'] ) ? wp_date( 'd M Y, H:i', strtotime( $order['created_at'] ) ) : '—' ) . '</td></tr>';
        }
        echo '</tbody></table></div>';
    }

    private static function orders() {
        $page   = max( 1, absint( $_GET['paged'] ?? 1 ) );
        $status = sanitize_key( wp_unslash( $_GET['status'] ?? '' ) );
        $data   = self::api( 'orders', array( 'page' => $page, 'per_page' => 25, 'status' => $status ), 30 );
        self::page_heading( __( 'Merchant orders', 'viasetu-woocommerce' ), __( 'Tenant-scoped ViaSetu bookings from WooCommerce and other connected channels.', 'viasetu-woocommerce' ), '<a class="button" href="' . esc_url( admin_url( 'admin.php?page=viasetu&tab=orders&refresh=1' ) ) . '">' . esc_html__( 'Refresh orders', 'viasetu-woocommerce' ) . '</a>' );
        if ( is_wp_error( $data ) ) { self::api_error( $data ); return; }
        echo '<section class="viasetu-card full"><form class="viasetu-filter" method="get"><input type="hidden" name="page" value="viasetu"><input type="hidden" name="tab" value="orders"><label>' . esc_html__( 'Shipment status', 'viasetu-woocommerce' ) . '<select name="status"><option value="">' . esc_html__( 'All statuses', 'viasetu-woocommerce' ) . '</option>';
        foreach ( array( 'pending_pickup' => 'Pending pickup', 'in_transit' => 'In transit', 'out_for_delivery' => 'Out for delivery', 'delivered' => 'Delivered', 'cancelled' => 'Cancelled', 'rto' => 'RTO' ) as $value => $label ) echo '<option value="' . esc_attr( $value ) . '" ' . selected( $status, $value, false ) . '>' . esc_html( $label ) . '</option>';
        echo '</select></label><button class="button">' . esc_html__( 'Apply filter', 'viasetu-woocommerce' ) . '</button></form>';
        self::merchant_orders_table( $data['orders'] ?? array() );
        $pagination = $data['pagination'] ?? array();
        if ( (int) ( $pagination['total_pages'] ?? 0 ) > 1 ) echo '<div class="viasetu-pagination">' . wp_kses_post( paginate_links( array( 'base' => add_query_arg( 'paged', '%#%' ), 'format' => '', 'current' => $page, 'total' => (int) $pagination['total_pages'] ) ) ) . '</div>';
        echo '</section>';
    }

    private static function shipments() {
        self::page_heading( __( 'WooCommerce fulfilment', 'viasetu-woocommerce' ), __( 'Local WooCommerce orders linked to ViaSetu booking, AWB, label and tracking metadata.', 'viasetu-woocommerce' ), '<a class="button button-primary" href="' . esc_url( admin_url( 'edit.php?post_type=shop_order' ) ) . '">' . esc_html__( 'Open WooCommerce orders', 'viasetu-woocommerce' ) . '</a>' );
        $orders = wc_get_orders( array( 'limit' => 50, 'orderby' => 'date', 'order' => 'DESC', 'meta_key' => '_viasetu_booking_id', 'meta_compare' => 'EXISTS' ) );
        echo '<section class="viasetu-card full"><div class="viasetu-card-head"><div><h2>' . esc_html__( 'Connected shipments', 'viasetu-woocommerce' ) . '</h2><p>' . esc_html__( 'Use the WooCommerce order action menu to create, refresh, fetch a label or cancel.', 'viasetu-woocommerce' ) . '</p></div></div><div class="viasetu-table-wrap"><table class="viasetu-table"><thead><tr><th>' . esc_html__( 'Order', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Customer', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'AWB', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Status', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Total', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Label', 'viasetu-woocommerce' ) . '</th></tr></thead><tbody>';
        if ( ! $orders ) echo '<tr><td colspan="6" class="viasetu-table-empty">' . esc_html__( 'No WooCommerce order has a ViaSetu shipment yet.', 'viasetu-woocommerce' ) . '</td></tr>';
        foreach ( $orders as $order ) {
            $label = esc_url( $order->get_meta( '_viasetu_label_url' ) );
            echo '<tr><td><a href="' . esc_url( $order->get_edit_order_url() ) . '"><strong>#' . esc_html( $order->get_order_number() ) . '</strong></a><small>' . esc_html( $order->get_meta( '_viasetu_booking_id' ) ) . '</small></td><td>' . esc_html( $order->get_formatted_billing_full_name() ) . '</td><td>' . esc_html( $order->get_meta( '_viasetu_awb' ) ?: 'Pending' ) . '</td><td>' . self::status_badge( $order->get_meta( '_viasetu_status' ) ?: 'Created' ) . '</td><td>' . wp_kses_post( $order->get_formatted_order_total() ) . '</td><td>' . ( $label ? '<a class="button button-small" target="_blank" rel="noopener" href="' . $label . '">' . esc_html__( 'Download', 'viasetu-woocommerce' ) . '</a>' : '<span class="viasetu-muted">' . esc_html__( 'Not ready', 'viasetu-woocommerce' ) . '</span>' ) . '</td></tr>';
        }
        echo '</tbody></table></div></section>';
    }

    private static function billing() {
        $data = self::api( 'billing', array( 'limit' => 100 ), 45 );
        self::page_heading( __( 'Wallet & billing', 'viasetu-woocommerce' ), __( 'Current prepaid balance and the latest merchant ledger activity.', 'viasetu-woocommerce' ), '<a class="button" target="_blank" rel="noopener" href="https://www.viasetu.com/viasetuforbusinesses/wallet">' . esc_html__( 'Manage wallet in ViaSetu', 'viasetu-woocommerce' ) . '</a>' );
        if ( is_wp_error( $data ) ) { self::api_error( $data ); return; }
        $wallet = $data['wallet'] ?? array();
        echo '<section class="viasetu-wallet"><div><span>' . esc_html__( 'Available balance', 'viasetu-woocommerce' ) . '</span><strong>' . esc_html( self::money( $wallet['balance'] ?? 0 ) ) . '</strong><small>' . esc_html__( 'Prepaid ViaSetu wallet · INR', 'viasetu-woocommerce' ) . '</small></div><span class="dashicons dashicons-money-alt"></span></section>';
        echo '<section class="viasetu-card full"><div class="viasetu-card-head"><div><h2>' . esc_html__( 'Recent transactions', 'viasetu-woocommerce' ) . '</h2><p>' . esc_html__( 'Server-calculated wallet movements. Amounts cannot be edited from WordPress.', 'viasetu-woocommerce' ) . '</p></div></div><div class="viasetu-table-wrap"><table class="viasetu-table"><thead><tr><th>' . esc_html__( 'Date', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Type', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Reference', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Amount', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Balance after', 'viasetu-woocommerce' ) . '</th></tr></thead><tbody>';
        $transactions = $data['transactions'] ?? array();
        if ( ! $transactions ) echo '<tr><td colspan="5" class="viasetu-table-empty">' . esc_html__( 'No wallet activity yet.', 'viasetu-woocommerce' ) . '</td></tr>';
        foreach ( $transactions as $transaction ) {
            $amount = (float) ( $transaction['amount'] ?? 0 );
            echo '<tr><td>' . esc_html( wp_date( 'd M Y, H:i', strtotime( $transaction['created_at'] ?? 'now' ) ) ) . '</td><td>' . esc_html( ucwords( str_replace( '_', ' ', $transaction['type'] ?? '' ) ) ) . '<small>' . esc_html( $transaction['note'] ?? '' ) . '</small></td><td>' . esc_html( $transaction['booking_id'] ?? '—' ) . '</td><td class="' . esc_attr( $amount >= 0 ? 'viasetu-credit' : 'viasetu-debit' ) . '">' . esc_html( ( $amount >= 0 ? '+' : '' ) . self::money( $amount ) ) . '</td><td>' . esc_html( self::money( $transaction['balance_after'] ?? 0 ) ) . '</td></tr>';
        }
        echo '</tbody></table></div></section>';
    }

    private static function labels() {
        $s = ViaSetu_Settings::get_all();
        self::page_heading( __( 'Labels & documents', 'viasetu-woocommerce' ), __( 'Retrieve and manage authoritative courier labels inside WooCommerce.', 'viasetu-woocommerce' ) );
        echo '<div class="viasetu-grid"><section class="viasetu-card full"><h2>' . esc_html__( 'Label retrieval', 'viasetu-woocommerce' ) . '</h2>';
        self::form_start( 'labels' );
        echo '<div class="viasetu-toggle-list"><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[label_auto_fetch]" ' . checked( $s['label_auto_fetch'], 'yes', false ) . '> ' . esc_html__( 'Fetch the courier label automatically after a successful shipment creation', 'viasetu-woocommerce' ) . '</label></div>';
        submit_button( __( 'Save label retrieval', 'viasetu-woocommerce' ) ); echo '</form></section><section class="viasetu-card"><h2>' . esc_html__( 'Courier-authoritative output', 'viasetu-woocommerce' ) . '</h2><p>' . esc_html__( 'ViaSetu returns the label generated by the selected courier. Paper size and file format are not rewritten in WordPress, preventing barcode or layout damage.', 'viasetu-woocommerce' ) . '</p></section><section class="viasetu-card"><h2>' . esc_html__( 'Order workflow', 'viasetu-woocommerce' ) . '</h2><p>' . esc_html__( 'Open a WooCommerce order and run “ViaSetu: Fetch label”, or download a ready label from Shipments.', 'viasetu-woocommerce' ) . '</p><a class="button" href="' . esc_url( admin_url( 'admin.php?page=viasetu&tab=shipments' ) ) . '">' . esc_html__( 'Open shipments', 'viasetu-woocommerce' ) . '</a></section></div>';
    }

    private static function form_start( $section ) {
        echo '<form method="post" action="options.php">';
        settings_fields( 'viasetu_wc' );
        echo '<input type="hidden" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[_section]" value="' . esc_attr( $section ) . '">';
    }

    private static function connection() {
        $s       = ViaSetu_Settings::get_all();
        $account = get_transient( 'viasetu_wc_account_' . get_current_user_id() );
        $ready   = ViaSetu_Settings::is_connected();
        self::page_heading( __( 'Merchant connection', 'viasetu-woocommerce' ), __( 'One secure authorization connects this store without sharing a merchant password.', 'viasetu-woocommerce' ) );
        echo '<div class="viasetu-grid"><section class="viasetu-connect-card ' . esc_attr( $ready ? 'is-connected' : '' ) . '"><div><span class="viasetu-connect-kicker">' . esc_html( $ready ? __( 'Active bridge', 'viasetu-woocommerce' ) : __( 'Recommended setup', 'viasetu-woocommerce' ) ) . '</span><h2>' . esc_html( $ready ? ( $s['merchant_company'] ?: __( 'ViaSetu merchant connected', 'viasetu-woocommerce' ) ) : __( 'Connect with ViaSetu', 'viasetu-woocommerce' ) ) . '</h2><p>' . esc_html( $ready ? sprintf( __( 'This store is connected in %s mode. Credentials are encrypted at rest.', 'viasetu-woocommerce' ), strtoupper( $s['environment'] ) ) : __( 'Sign in or apply for a merchant account, review the store permissions, then return automatically to WordPress.', 'viasetu-woocommerce' ) ) . '</p>';
        if ( $ready ) echo '<dl class="viasetu-details"><div><dt>' . esc_html__( 'Merchant email', 'viasetu-woocommerce' ) . '</dt><dd>' . esc_html( $s['merchant_email'] ?: '—' ) . '</dd></div><div><dt>' . esc_html__( 'Connected', 'viasetu-woocommerce' ) . '</dt><dd>' . esc_html( $s['connected_at'] ?: '—' ) . '</dd></div><div><dt>' . esc_html__( 'Webhook', 'viasetu-woocommerce' ) . '</dt><dd>' . esc_html__( 'Signed and active', 'viasetu-woocommerce' ) . '</dd></div></dl>';
        echo '</div><div class="viasetu-connect-actions">';
        if ( $ready ) {
            echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="viasetu_test_connection">'; wp_nonce_field( 'viasetu_test_connection' ); submit_button( __( 'Test connection', 'viasetu-woocommerce' ), 'secondary', 'submit', false ); echo '</form><a class="button button-link-delete" href="' . esc_url( ViaSetu_Connect::disconnect_url() ) . '" onclick="return confirm(\'' . esc_js( __( 'Disconnect this store and revoke its dedicated key?', 'viasetu-woocommerce' ) ) . '\')">' . esc_html__( 'Disconnect store', 'viasetu-woocommerce' ) . '</a>';
        } else {
            echo '<a class="button button-primary button-hero" href="' . esc_url( ViaSetu_Connect::start_url() ) . '">' . esc_html__( 'Sign in and connect', 'viasetu-woocommerce' ) . '</a><a class="button" target="_blank" rel="noopener" href="https://www.viasetu.com/for-business?source=woocommerce">' . esc_html__( 'Create / apply for account', 'viasetu-woocommerce' ) . '</a>';
        }
        echo '</div></section>';
        if ( is_array( $account ) ) echo '<section class="viasetu-card full"><h2>' . esc_html__( 'Last connection test', 'viasetu-woocommerce' ) . '</h2><p>' . esc_html( sprintf( __( 'Merchant: %1$s · Wallet: %2$s', 'viasetu-woocommerce' ), $account['merchant']['company_name'] ?? '—', self::money( $account['wallet']['balance'] ?? 0 ) ) ) . '</p></section>';

        echo '<section class="viasetu-card full"><details><summary>' . esc_html__( 'Advanced manual API-key setup', 'viasetu-woocommerce' ) . '</summary><p>' . esc_html__( 'Use only when the one-click flow is unavailable. Create a dedicated store-scoped key in ViaSetu Developer Tools.', 'viasetu-woocommerce' ) . '</p>';
        self::form_start( 'connection' );
        echo '<table class="form-table viasetu-form-table"><tr><th>' . esc_html__( 'Integration', 'viasetu-woocommerce' ) . '</th><td><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[enabled]" ' . checked( $s['enabled'], 'yes', false ) . '> ' . esc_html__( 'Enable ViaSetu checkout and order tools', 'viasetu-woocommerce' ) . '</label></td></tr><tr><th>' . esc_html__( 'Merchant API key', 'viasetu-woocommerce' ) . '</th><td><input class="regular-text" type="password" autocomplete="new-password" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[api_key]" placeholder="' . esc_attr( ViaSetu_Settings::api_key() ? __( 'Configured — enter a new key to replace', 'viasetu-woocommerce' ) : 'vs_live_…' ) . '"><p class="description">' . esc_html__( 'Encrypted before storage. Leave blank to keep the current key.', 'viasetu-woocommerce' ) . '</p></td></tr><tr><th>' . esc_html__( 'API endpoint', 'viasetu-woocommerce' ) . '</th><td><input class="large-text code" type="url" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[api_endpoint]" value="' . esc_attr( $s['api_endpoint'] ) . '"></td></tr><tr><th>' . esc_html__( 'Webhook signing secret', 'viasetu-woocommerce' ) . '</th><td><input class="regular-text" type="password" autocomplete="new-password" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[webhook_secret]" placeholder="' . esc_attr( ViaSetu_Settings::webhook_secret() ? __( 'Configured — enter a new secret to replace', 'viasetu-woocommerce' ) : '' ) . '"><code class="viasetu-code">' . esc_html( rest_url( 'viasetu/v1/webhook' ) ) . '</code></td></tr></table>';
        submit_button( __( 'Save manual connection', 'viasetu-woocommerce' ) ); echo '</form></details></section></div>';
    }

    private static function shipping() {
        $s = ViaSetu_Settings::get_all();
        self::page_heading( __( 'Shipping & checkout', 'viasetu-woocommerce' ), __( 'Pickup identity, live rate presentation and checkout fallback rules.', 'viasetu-woocommerce' ) );
        echo '<section class="viasetu-card full"><div class="viasetu-callout"><span class="dashicons dashicons-info"></span><p>' . esc_html__( 'After saving, add “ViaSetu Shipping” to each WooCommerce shipping zone where it should appear.', 'viasetu-woocommerce' ) . '</p></div>';
        self::form_start( 'shipping' );
        echo '<h2>' . esc_html__( 'Pickup address', 'viasetu-woocommerce' ) . '</h2><div class="viasetu-field-grid">';
        foreach ( array( 'pickup_name' => 'Contact name', 'pickup_phone' => 'Phone', 'pickup_address' => 'Address', 'pickup_city' => 'City', 'pickup_state' => 'State', 'pickup_pincode' => 'Pincode' ) as $field => $label ) echo '<label><span>' . esc_html( $label ) . '</span><input type="text" name="' . esc_attr( ViaSetu_Settings::OPTION . '[' . $field . ']' ) . '" value="' . esc_attr( $s[ $field ] ) . '"></label>';
        echo '</div><hr><h2>' . esc_html__( 'Checkout presentation', 'viasetu-woocommerce' ) . '</h2><div class="viasetu-field-grid"><label><span>' . esc_html__( 'Checkout label', 'viasetu-woocommerce' ) . '</span><input type="text" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[shipping_title]" value="' . esc_attr( $s['shipping_title'] ) . '"></label><label><span>' . esc_html__( 'Default goods type', 'viasetu-woocommerce' ) . '</span><input type="text" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[default_goods_type]" value="' . esc_attr( $s['default_goods_type'] ) . '"></label><label><span>' . esc_html__( 'Rate priority', 'viasetu-woocommerce' ) . '</span><select name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[quote_sort]"><option value="price" ' . selected( $s['quote_sort'], 'price', false ) . '>' . esc_html__( 'Lowest price first', 'viasetu-woocommerce' ) . '</option><option value="fastest" ' . selected( $s['quote_sort'], 'fastest', false ) . '>' . esc_html__( 'Fastest first', 'viasetu-woocommerce' ) . '</option><option value="preferred" ' . selected( $s['quote_sort'], 'preferred', false ) . '>' . esc_html__( 'Preferred couriers first', 'viasetu-woocommerce' ) . '</option></select></label><label><span>' . esc_html__( 'Preferred courier codes', 'viasetu-woocommerce' ) . '</span><input type="text" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[preferred_partners]" value="' . esc_attr( $s['preferred_partners'] ) . '" placeholder="delhivery, xpressbees"></label></div>';
        echo '<h3>' . esc_html__( 'Fallback parcel size (cm)', 'viasetu-woocommerce' ) . '</h3><div class="viasetu-inline-fields">'; foreach ( array( 'default_length' => 'Length', 'default_width' => 'Width', 'default_height' => 'Height' ) as $field => $label ) echo '<label><span>' . esc_html( $label ) . '</span><input type="number" min="1" max="300" name="' . esc_attr( ViaSetu_Settings::OPTION . '[' . $field . ']' ) . '" value="' . esc_attr( $s[ $field ] ) . '"></label>'; echo '</div>';
        echo '<div class="viasetu-toggle-list"><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[show_courier]" ' . checked( $s['show_courier'], 'yes', false ) . '> ' . esc_html__( 'Show courier name', 'viasetu-woocommerce' ) . '</label><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[show_eta]" ' . checked( $s['show_eta'], 'yes', false ) . '> ' . esc_html__( 'Show delivery estimate', 'viasetu-woocommerce' ) . '</label><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[enable_cod]" ' . checked( $s['enable_cod'], 'yes', false ) . '> ' . esc_html__( 'Allow Cash on Delivery', 'viasetu-woocommerce' ) . '</label><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[fallback_enabled]" ' . checked( $s['fallback_enabled'], 'yes', false ) . '> ' . esc_html__( 'Offer fallback when live rates are unavailable', 'viasetu-woocommerce' ) . '</label></div><label class="viasetu-compact-field"><span>' . esc_html__( 'Fallback rate (₹)', 'viasetu-woocommerce' ) . '</span><input type="number" min="0" step="0.01" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[fallback_cost]" value="' . esc_attr( $s['fallback_cost'] ) . '"></label>';
        submit_button( __( 'Save shipping rules', 'viasetu-woocommerce' ) ); echo '</form></section>';
    }

    private static function products() {
        self::page_heading( __( 'Product shipping data', 'viasetu-woocommerce' ), __( 'Accurate dimensions and handling rules produce reliable rates.', 'viasetu-woocommerce' ) );
        echo '<div class="viasetu-grid"><section class="viasetu-card"><span class="dashicons dashicons-products viasetu-card-icon"></span><h2>' . esc_html__( 'WooCommerce catalogue', 'viasetu-woocommerce' ) . '</h2><p>' . esc_html__( 'ViaSetu reads each product’s WooCommerce weight and dimensions. Complete those fields before enabling live rates.', 'viasetu-woocommerce' ) . '</p><a class="button button-primary" href="' . esc_url( admin_url( 'edit.php?post_type=product' ) ) . '">' . esc_html__( 'Manage products', 'viasetu-woocommerce' ) . '</a></section><section class="viasetu-card"><span class="dashicons dashicons-admin-tools viasetu-card-icon"></span><h2>' . esc_html__( 'Per-product controls', 'viasetu-woocommerce' ) . '</h2><ul class="viasetu-checklist"><li>' . esc_html__( 'Exclude a product from ViaSetu checkout', 'viasetu-woocommerce' ) . '</li><li>' . esc_html__( 'Set a shipment goods type', 'viasetu-woocommerce' ) . '</li><li>' . esc_html__( 'Mark fragile products for merchant handling', 'viasetu-woocommerce' ) . '</li></ul><p class="description">' . esc_html__( 'Open a product and use Product data → Shipping.', 'viasetu-woocommerce' ) . '</p></section></div>';
    }

    private static function sync() {
        $s = ViaSetu_Settings::get_all();
        self::page_heading( __( 'Automation & sync', 'viasetu-woocommerce' ), __( 'Control booking triggers, tracking refresh and signed status updates.', 'viasetu-woocommerce' ) );
        echo '<div class="viasetu-grid"><section class="viasetu-card"><h2>' . esc_html__( 'Run shipment sync', 'viasetu-woocommerce' ) . '</h2><p>' . esc_html__( 'Refresh open ViaSetu shipments now. Scheduled sync continues in the background.', 'viasetu-woocommerce' ) . '</p><form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="viasetu_sync_now">'; wp_nonce_field( 'viasetu_sync_now' ); submit_button( __( 'Sync now', 'viasetu-woocommerce' ), 'primary', 'submit', false ); echo '</form></section><section class="viasetu-card"><h2>' . esc_html__( 'Signed webhook receiver', 'viasetu-woocommerce' ) . '</h2><code class="viasetu-code">' . esc_html( rest_url( 'viasetu/v1/webhook' ) ) . '</code><p>' . esc_html__( 'One-click connection registers this endpoint and its signing secret automatically.', 'viasetu-woocommerce' ) . '</p></section>';
        echo '<section class="viasetu-card full"><h2>' . esc_html__( 'Automation rules', 'viasetu-woocommerce' ) . '</h2>'; self::form_start( 'sync' );
        echo '<div class="viasetu-toggle-list"><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[auto_create]" ' . checked( $s['auto_create'], 'yes', false ) . '> ' . esc_html__( 'Create a shipment when an order enters a selected status', 'viasetu-woocommerce' ) . '</label><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[complete_when_delivered]" ' . checked( $s['complete_when_delivered'], 'yes', false ) . '> ' . esc_html__( 'Mark WooCommerce order Completed after ViaSetu delivery', 'viasetu-woocommerce' ) . '</label><label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[debug_logging]" ' . checked( $s['debug_logging'], 'yes', false ) . '> ' . esc_html__( 'Enable redacted diagnostic logs', 'viasetu-woocommerce' ) . '</label></div><h3>' . esc_html__( 'Automatic booking statuses', 'viasetu-woocommerce' ) . '</h3><div class="viasetu-inline-checks">';
        foreach ( array( 'pending' => 'Pending payment', 'on-hold' => 'On hold', 'processing' => 'Processing', 'completed' => 'Completed' ) as $status => $label ) echo '<label><input type="checkbox" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[auto_create_statuses][]" value="' . esc_attr( $status ) . '" ' . checked( in_array( $status, (array) $s['auto_create_statuses'], true ), true, false ) . '> ' . esc_html( $label ) . '</label>';
        echo '</div><div class="viasetu-field-grid"><label><span>' . esc_html__( 'Tracking schedule', 'viasetu-woocommerce' ) . '</span><select name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[sync_interval]"><option value="viasetu_15_minutes" ' . selected( $s['sync_interval'], 'viasetu_15_minutes', false ) . '>' . esc_html__( 'Every 15 minutes', 'viasetu-woocommerce' ) . '</option><option value="hourly" ' . selected( $s['sync_interval'], 'hourly', false ) . '>' . esc_html__( 'Hourly', 'viasetu-woocommerce' ) . '</option><option value="twicedaily" ' . selected( $s['sync_interval'], 'twicedaily', false ) . '>' . esc_html__( 'Twice daily', 'viasetu-woocommerce' ) . '</option></select></label><label><span>' . esc_html__( 'Orders per run', 'viasetu-woocommerce' ) . '</span><input type="number" min="10" max="200" name="' . esc_attr( ViaSetu_Settings::OPTION ) . '[sync_batch_size]" value="' . esc_attr( $s['sync_batch_size'] ) . '"></label></div>';
        submit_button( __( 'Save automation', 'viasetu-woocommerce' ) ); echo '</form></section></div>';
    }

    private static function diagnostics() {
        self::page_heading( __( 'Diagnostics & security', 'viasetu-woocommerce' ), __( 'Read-only health checks and redacted integration events.', 'viasetu-woocommerce' ) );
        $checks = array(
            array( 'WordPress HTTPS', is_ssl() || ( defined( 'VIASETU_WC_DEMO_MODE' ) && VIASETU_WC_DEMO_MODE ), home_url() ),
            array( 'WooCommerce 8.0+', defined( 'WC_VERSION' ) && version_compare( WC_VERSION, '8.0', '>=' ), defined( 'WC_VERSION' ) ? WC_VERSION : 'Missing' ),
            array( 'PHP 7.4+', version_compare( PHP_VERSION, '7.4', '>=' ), PHP_VERSION ),
            array( 'Credential encryption', ViaSetu_Settings::encryption_available(), function_exists( 'sodium_crypto_secretbox' ) ? 'Sodium' : ( function_exists( 'openssl_encrypt' ) ? 'OpenSSL AES-256-GCM' : 'Unavailable' ) ),
            array( 'Merchant connection', ViaSetu_Settings::is_connected(), ViaSetu_Settings::is_connected() ? 'Encrypted API key present' : 'Not connected' ),
            array( 'WP-Cron sync', (bool) wp_next_scheduled( 'viasetu_wc_tracking_sync' ), wp_next_scheduled( 'viasetu_wc_tracking_sync' ) ? wp_date( 'Y-m-d H:i:s', wp_next_scheduled( 'viasetu_wc_tracking_sync' ) ) : 'Not scheduled' ),
        );
        echo '<div class="viasetu-grid"><section class="viasetu-card full"><h2>' . esc_html__( 'System health', 'viasetu-woocommerce' ) . '</h2><ul class="viasetu-checklist">'; foreach ( $checks as $check ) echo '<li><span>' . esc_html( $check[0] ) . '<small>' . esc_html( $check[2] ) . '</small></span><strong class="viasetu-' . esc_attr( $check[1] ? 'good' : 'bad' ) . '">' . esc_html( $check[1] ? 'Pass' : 'Check' ) . '</strong></li>'; echo '</ul></section><section class="viasetu-card full"><div class="viasetu-card-head"><div><h2>' . esc_html__( 'Recent integration logs', 'viasetu-woocommerce' ) . '</h2><p>' . esc_html__( 'Credentials, customer addresses and raw provider payloads are never written here.', 'viasetu-woocommerce' ) . '</p></div><form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="viasetu_clear_logs">'; wp_nonce_field( 'viasetu_clear_logs' ); submit_button( __( 'Clear logs', 'viasetu-woocommerce' ), 'secondary', 'submit', false ); echo '</form></div><div class="viasetu-table-wrap"><table class="viasetu-table"><thead><tr><th>' . esc_html__( 'Time', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Level', 'viasetu-woocommerce' ) . '</th><th>' . esc_html__( 'Message', 'viasetu-woocommerce' ) . '</th></tr></thead><tbody>';
        $logs = ViaSetu_Logger::all();
        if ( ! $logs ) echo '<tr><td colspan="3" class="viasetu-table-empty">' . esc_html__( 'No integration events recorded yet.', 'viasetu-woocommerce' ) . '</td></tr>';
        foreach ( array_slice( $logs, 0, 50 ) as $log ) echo '<tr><td>' . esc_html( $log['time'] ?? '' ) . '</td><td><span class="viasetu-pill viasetu-pill-' . esc_attr( 'error' === ( $log['level'] ?? '' ) ? 'bad' : 'info' ) . '">' . esc_html( strtoupper( $log['level'] ?? 'info' ) ) . '</span></td><td>' . esc_html( $log['message'] ?? '' ) . '</td></tr>';
        echo '</tbody></table></div></section></div>';
    }

    private static function api_error( $error ) {
        echo '<section class="viasetu-error"><span class="dashicons dashicons-warning"></span><div><h2>' . esc_html__( 'ViaSetu data is unavailable', 'viasetu-woocommerce' ) . '</h2><p>' . esc_html( $error->get_error_message() ) . '</p><a class="button" href="' . esc_url( admin_url( 'admin.php?page=viasetu&tab=connection' ) ) . '">' . esc_html__( 'Check connection', 'viasetu-woocommerce' ) . '</a></div></section>';
    }

    private static function check_item( $label, $done ) {
        echo '<li><span>' . esc_html( $label ) . '</span><strong class="viasetu-' . esc_attr( $done ? 'good' : 'warn' ) . '">' . esc_html( $done ? __( 'Ready', 'viasetu-woocommerce' ) : __( 'Action needed', 'viasetu-woocommerce' ) ) . '</strong></li>';
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
}
