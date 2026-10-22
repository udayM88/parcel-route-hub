<?php
defined( 'ABSPATH' ) || exit;

final class ViaSetu_Webhooks {
    public static function init() {
        add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
    }

    public static function routes() {
        register_rest_route(
            'viasetu/v1',
            '/webhook',
            array(
                'methods'             => 'POST',
                'callback'            => array( __CLASS__, 'receive' ),
                'permission_callback' => '__return_true',
            )
        );
    }

    public static function receive( WP_REST_Request $request ) {
        $secret    = ViaSetu_Settings::webhook_secret();
        $timestamp = (string) $request->get_header( 'x-viasetu-timestamp' );
        $signature = (string) $request->get_header( 'x-viasetu-signature' );
        $delivery  = sanitize_text_field( $request->get_header( 'x-viasetu-delivery' ) );
        $raw       = $request->get_body();

        if ( '' === $secret || ! ctype_digit( $timestamp ) || abs( time() - (int) $timestamp ) > 300 ) {
            ViaSetu_Logger::log( 'error', 'Rejected an expired or unsigned webhook' );
            return new WP_REST_Response( array( 'success' => false, 'error' => 'Invalid or expired webhook.' ), 401 );
        }
        $expected = 'sha256=' . hash_hmac( 'sha256', $timestamp . '.' . $raw, $secret );
        if ( ! hash_equals( $expected, $signature ) ) {
            ViaSetu_Logger::log( 'error', 'Rejected a webhook with an invalid signature' );
            return new WP_REST_Response( array( 'success' => false, 'error' => 'Invalid signature.' ), 401 );
        }

        $payload    = json_decode( $raw, true );
        $object     = $payload['data']['object'] ?? array();
        $booking_id = sanitize_text_field( $object['booking_id'] ?? '' );
        if ( '' === $booking_id ) return new WP_REST_Response( array( 'success' => false, 'error' => 'Missing booking_id.' ), 400 );

        $orders = wc_get_orders(
            array(
                'limit'      => 1,
                'meta_key'   => '_viasetu_booking_id',
                'meta_value' => $booking_id,
            )
        );
        $order = ! empty( $orders ) ? reset( $orders ) : null;
        if ( ! $order instanceof WC_Order ) return new WP_REST_Response( array( 'success' => false, 'error' => 'Order not found.' ), 404 );

        $handled = (array) $order->get_meta( '_viasetu_webhook_deliveries' );
        if ( $delivery && in_array( $delivery, $handled, true ) ) return new WP_REST_Response( array( 'success' => true, 'duplicate' => true ), 200 );
        if ( $delivery ) {
            $handled[] = $delivery;
            $order->update_meta_data( '_viasetu_webhook_deliveries', array_slice( array_unique( $handled ), -20 ) );
            $order->save();
        }
        ViaSetu_Order_Actions::apply_status( $order, $object['status'] ?? '', $object['awb'] ?? '', 'signed webhook' );
        ViaSetu_Logger::log( 'debug', 'Signed webhook processed', array( 'order_id' => $order->get_id(), 'delivery_id' => $delivery ) );
        return new WP_REST_Response( array( 'success' => true ), 200 );
    }
}
