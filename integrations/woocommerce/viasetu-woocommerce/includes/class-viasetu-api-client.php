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
        return 'yes' === ViaSetu_Settings::get( 'enabled' ) && '' !== $this->api_key && 0 === strpos( $this->endpoint, 'https://' );
    }

    public function request( $action, $payload = array(), $idempotency_key = '' ) {
        if ( ! $this->is_configured() ) {
            return new WP_Error( 'viasetu_not_configured', __( 'ViaSetu is not configured.', 'viasetu-woocommerce' ) );
        }

        $headers = array(
            'Authorization' => 'Bearer ' . $this->api_key,
            'Content-Type'  => 'application/json',
            'User-Agent'    => 'ViaSetu-WooCommerce/' . VIASETU_WC_VERSION . '; ' . home_url( '/' ),
        );
        if ( '' !== $idempotency_key ) $headers['Idempotency-Key'] = $idempotency_key;

        $response = wp_remote_post(
            $this->endpoint,
            array(
                'headers' => $headers,
                'body'    => wp_json_encode( array_merge( array( 'action' => $action ), $payload ) ),
                'timeout' => 20,
            )
        );
        if ( is_wp_error( $response ) ) return $response;

        $status = (int) wp_remote_retrieve_response_code( $response );
        $data   = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( $status >= 200 && $status < 300 && is_array( $data ) && false !== ( $data['success'] ?? true ) ) return $data;

        $code    = sanitize_key( $data['error']['code'] ?? 'request_failed' );
        $message = sanitize_text_field( $data['error']['message'] ?? sprintf( __( 'ViaSetu returned HTTP %d.', 'viasetu-woocommerce' ), $status ) );
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
}
