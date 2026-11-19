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
        return 'yes' === ViaSetu_Settings::get( 'enabled' )
            && ViaSetu_Settings::package_environment() === ViaSetu_Settings::get( 'environment' )
            && ViaSetu_Settings::api_key_is_valid( $this->api_key, ViaSetu_Settings::package_environment() )
            && 0 === strpos( $this->endpoint, 'https://' );
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
        if ( $status >= 200 && $status < 300 && is_array( $data ) && true === ( $data['success'] ?? false ) ) {
            ViaSetu_Logger::log( 'debug', 'Merchant API request completed', array( 'action' => $action, 'status' => $status ) );
            if ( 'account' === $action ) ViaSetu_Settings::mark_connection_checked( true );
            return $data;
        }

        $error   = is_array( $data ) ? ( $data['error'] ?? array() ) : array();
        $code    = sanitize_key( is_array( $error ) ? ( $error['code'] ?? 'request_failed' ) : 'request_failed' );
        $message = sanitize_text_field( is_array( $error ) ? ( $error['message'] ?? '' ) : (string) $error );
        if ( '' === $message ) $message = sanitize_text_field( is_array( $data ) ? ( $data['message'] ?? '' ) : '' );
        if ( '' === $message ) $message = sprintf( __( 'ViaSetu returned HTTP %d.', 'viasetu-woocommerce' ), $status );
        if ( in_array( $status, array( 401, 403 ), true ) ) ViaSetu_Settings::mark_connection_checked( false, $message );
        ViaSetu_Logger::log( 'error', 'Merchant API request rejected', array( 'action' => $action, 'status' => $status, 'code' => $code ) );
        return new WP_Error( 'viasetu_' . $code, $message, array( 'status' => $status, 'response' => $data ) );
    }

    public function rates( $pickup_pincode, $delivery_pincode, $boxes ) {
        $result = $this->request( 'rates', array( 'pickup_pincode' => $pickup_pincode, 'delivery_pincode' => $delivery_pincode, 'boxes' => $boxes ) );
        if ( ! is_wp_error( $result ) && ! isset( $result['quotes'] ) ) {
            return new WP_Error( 'viasetu_invalid_response', __( 'ViaSetu returned an invalid rate response.', 'viasetu-woocommerce' ) );
        }
        return $result;
    }

    public function create_shipment( $payload, $idempotency_key ) {
        $result = $this->request( 'create_shipment', $payload, $idempotency_key );
        if ( is_wp_error( $result ) ) return $result;
        $booking_id = sanitize_text_field( $result['booking_id'] ?? '' );
        if ( '' === $booking_id ) {
            return new WP_Error(
                'viasetu_invalid_booking_response',
                __( 'ViaSetu did not return a booking ID, so this shipment was not marked as created.', 'viasetu-woocommerce' ),
                array( 'status' => 502, 'response' => $result )
            );
        }
        return $result;
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
}
