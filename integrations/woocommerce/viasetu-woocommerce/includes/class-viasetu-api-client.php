<?php
defined( 'ABSPATH' ) || exit;

final class ViaSetu_Api_Client {
    private $endpoint;
    private $api_key;

    public function __construct() {
        $this->endpoint = untrailingslashit( ViaSetu_Settings::get( 'api_endpoint' ) );
        $this->api_key  = ViaSetu_Settings::api_key();
    }

    public function is_configured() {
        if ( defined( 'VIASETU_WC_DEMO_MODE' ) && VIASETU_WC_DEMO_MODE ) return true;
        return 'yes' === ViaSetu_Settings::get( 'enabled' ) && '' !== $this->api_key && 0 === strpos( $this->endpoint, 'https://' );
    }

    public function request( $action, $payload = array(), $idempotency_key = '' ) {
        if ( ! $this->is_configured() ) {
            return new WP_Error( 'viasetu_not_configured', __( 'ViaSetu is not configured.', 'viasetu-woocommerce' ) );
        }

        if ( defined( 'VIASETU_WC_DEMO_MODE' ) && VIASETU_WC_DEMO_MODE ) {
            return $this->demo_response( $action, $payload );
        }

        $headers = array(
            'Authorization' => 'Bearer ' . $this->api_key,
            'Content-Type'  => 'application/json',
            'User-Agent'    => 'ViaSetu-WooCommerce/' . VIASETU_WC_VERSION . '; ' . home_url( '/' ),
        );
        if ( '' !== $idempotency_key ) $headers['Idempotency-Key'] = $idempotency_key;

        $response = wp_safe_remote_post(
            $this->endpoint,
            array(
                'headers' => $headers,
                'body'    => wp_json_encode( array_merge( array( 'action' => $action ), $payload ) ),
                'timeout' => 20,
                'redirection' => 0,
                'sslverify' => true,
                'limit_response_size' => 512 * KB_IN_BYTES,
            )
        );
        if ( is_wp_error( $response ) ) {
            ViaSetu_Logger::log( 'error', 'Merchant API network request failed', array( 'action' => $action, 'error' => $response->get_error_message() ) );
            return $response;
        }

        $status = (int) wp_remote_retrieve_response_code( $response );
        $data   = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( $status >= 200 && $status < 300 && is_array( $data ) && false !== ( $data['success'] ?? true ) ) {
            ViaSetu_Logger::log( 'debug', 'Merchant API request completed', array( 'action' => $action, 'status' => $status ) );
            return $data;
        }

        $code    = sanitize_key( $data['error']['code'] ?? 'request_failed' );
        $message = sanitize_text_field( $data['error']['message'] ?? sprintf( __( 'ViaSetu returned HTTP %d.', 'viasetu-woocommerce' ), $status ) );
        ViaSetu_Logger::log( 'error', 'Merchant API request rejected', array( 'action' => $action, 'status' => $status, 'code' => $code ) );
        return new WP_Error( 'viasetu_' . $code, $message, array( 'status' => $status, 'response' => $data ) );
    }

    public function rates( $pickup_pincode, $delivery_pincode, $boxes ) {
        return $this->request( 'rates', array( 'pickup_pincode' => $pickup_pincode, 'delivery_pincode' => $delivery_pincode, 'boxes' => $boxes ) );
    }

    public function create_shipment( $payload, $idempotency_key ) {
        return $this->request( 'create_shipment', $payload, $idempotency_key );
    }

    public function track( $booking_id ) {
        return $this->request( 'track', array( 'booking_id' => $booking_id ) );
    }

    public function label( $booking_id ) {
        return $this->request( 'label', array( 'booking_id' => $booking_id ) );
    }

    public function cancel( $booking_id, $reason = '' ) {
        return $this->request( 'cancel', array( 'booking_id' => $booking_id, 'reason' => $reason ) );
    }

    public function wallet() {
        return $this->request( 'wallet' );
    }

    public function account() {
        return $this->request( 'account' );
    }

    public function dashboard() {
        return $this->request( 'dashboard' );
    }

    public function orders( $page = 1, $per_page = 25, $status = '' ) {
        return $this->request(
            'orders',
            array(
                'page'     => max( 1, absint( $page ) ),
                'per_page' => max( 10, min( 100, absint( $per_page ) ) ),
                'status'   => sanitize_key( $status ),
            )
        );
    }

    public function billing( $limit = 50 ) {
        return $this->request( 'billing', array( 'limit' => max( 10, min( 100, absint( $limit ) ) ) ) );
    }

    public function disconnect() {
        return $this->request( 'disconnect' );
    }

    private function demo_response( $action, $payload ) {
        $now    = current_time( 'mysql', true );
        $orders = array(
            array( 'id' => 'demo-1042', 'created_at' => $now, 'receiver_name' => 'Aarav Sharma', 'receiver_city' => 'Bengaluru', 'receiver_state' => 'Karnataka', 'receiver_pincode' => '560001', 'sender_name' => 'Demo Warehouse', 'sender_city' => 'Pune', 'sender_pincode' => '411001', 'courier_name' => 'Delhivery Surface', 'courier_price' => 186, 'gst' => 33.48, 'status' => 'IN_TRANSIT', 'tracking_id' => 'DLV-DEMO-92841', 'prayog_awb' => '', 'delivery_time' => '2-4 days', 'goods_type' => 'Apparel', 'package_weight' => '0.75', 'box_count' => 1, 'payment_status' => 'paid', 'booking_source' => 'woocommerce', 'label_url' => '' ),
            array( 'id' => 'demo-1041', 'created_at' => gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS ), 'receiver_name' => 'Meera Patel', 'receiver_city' => 'Ahmedabad', 'receiver_state' => 'Gujarat', 'receiver_pincode' => '380001', 'sender_name' => 'Demo Warehouse', 'sender_city' => 'Pune', 'sender_pincode' => '411001', 'courier_name' => 'XpressBees Air', 'courier_price' => 224, 'gst' => 40.32, 'status' => 'DELIVERED', 'tracking_id' => 'XB-DEMO-41022', 'prayog_awb' => '', 'delivery_time' => '1-2 days', 'goods_type' => 'Accessories', 'package_weight' => '0.45', 'box_count' => 1, 'payment_status' => 'paid', 'booking_source' => 'woocommerce', 'label_url' => '' ),
            array( 'id' => 'demo-1040', 'created_at' => gmdate( 'Y-m-d H:i:s', time() - 2 * DAY_IN_SECONDS ), 'receiver_name' => 'Kabir Singh', 'receiver_city' => 'New Delhi', 'receiver_state' => 'Delhi', 'receiver_pincode' => '110001', 'sender_name' => 'Demo Warehouse', 'sender_city' => 'Pune', 'sender_pincode' => '411001', 'courier_name' => 'Shadowfax Surface', 'courier_price' => 172, 'gst' => 30.96, 'status' => 'PENDING_PICKUP', 'tracking_id' => 'SFX-DEMO-33109', 'prayog_awb' => '', 'delivery_time' => '3-5 days', 'goods_type' => 'Home decor', 'package_weight' => '1.20', 'box_count' => 1, 'payment_status' => 'paid', 'booking_source' => 'woocommerce', 'label_url' => '' ),
        );
        if ( 'wallet' === $action ) return array( 'success' => true, 'balance' => 12450.75, 'currency' => 'INR', 'demo' => true );
        if ( 'account' === $action ) return array( 'success' => true, 'merchant' => array( 'company_name' => 'ViaSetu Demo Store', 'contact_person' => 'Demo Merchant', 'email' => get_option( 'admin_email' ), 'status' => 'approved' ), 'wallet' => array( 'balance' => 12450.75, 'low_balance_threshold' => 500, 'currency' => 'INR' ), 'connection' => array( 'id' => 'demo-connection', 'status' => 'active', 'environment' => 'sandbox', 'store_name' => get_bloginfo( 'name' ), 'plugin_version' => VIASETU_WC_VERSION ), 'demo' => true );
        if ( 'dashboard' === $action ) return array( 'success' => true, 'metrics' => array( 'total_shipments' => 128, 'active_shipments' => 18, 'delivered_shipments' => 107, 'exceptions' => 3 ), 'wallet' => array( 'balance' => 12450.75, 'low_balance_threshold' => 500, 'currency' => 'INR' ), 'recent_orders' => $orders, 'demo' => true );
        if ( 'orders' === $action ) return array( 'success' => true, 'orders' => $orders, 'pagination' => array( 'page' => 1, 'per_page' => 25, 'total' => count( $orders ), 'total_pages' => 1 ), 'demo' => true );
        if ( 'billing' === $action ) return array( 'success' => true, 'wallet' => array( 'balance' => 12450.75, 'low_balance_threshold' => 500, 'currency' => 'INR' ), 'transactions' => array( array( 'id' => 'demo-tx-3', 'type' => 'shipment_debit', 'amount' => -219.48, 'balance_after' => 12450.75, 'booking_id' => 'demo-1042', 'note' => 'Demo shipment charge', 'created_at' => $now ), array( 'id' => 'demo-tx-2', 'type' => 'wallet_topup', 'amount' => 5000, 'balance_after' => 12670.23, 'booking_id' => null, 'note' => 'Demo wallet top-up', 'created_at' => gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS ) ) ), 'demo' => true );
        if ( 'rates' === $action ) return array( 'success' => true, 'quotes' => array( array( 'partner_code' => 'delhivery', 'partner_name' => 'Delhivery', 'service_code' => 'surface', 'service_name' => 'Surface', 'delivery_time' => '2-4 days', 'amount_excl_gst' => 186, 'gst' => 33, 'total_amount' => 219, 'currency' => 'INR' ) ), 'demo' => true );
        if ( 'track' === $action ) return array( 'success' => true, 'booking_id' => sanitize_text_field( $payload['booking_id'] ?? 'demo-1042' ), 'status' => 'IN_TRANSIT', 'awb' => 'DLV-DEMO-92841', 'events' => array(), 'demo' => true );
        if ( 'create_shipment' === $action ) return array( 'success' => true, 'booking_id' => 'demo-created-' . wp_rand( 1000, 9999 ), 'status' => 'CREATED', 'courier' => 'Demo Courier', 'boxes' => array( array( 'box_index' => 1, 'success' => true, 'awb' => 'DEMO' . wp_rand( 100000, 999999 ) ) ), 'demo' => true );
        if ( in_array( $action, array( 'cancel', 'disconnect' ), true ) ) return array( 'success' => true, 'demo' => true );
        if ( 'label' === $action ) return new WP_Error( 'viasetu_demo_label', __( 'Demo mode does not download an external label.', 'viasetu-woocommerce' ) );
        return new WP_Error( 'viasetu_demo_action', __( 'This action is not available in demo mode.', 'viasetu-woocommerce' ) );
    }
}
