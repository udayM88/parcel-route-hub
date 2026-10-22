<?php
defined( 'ABSPATH' ) || exit;

final class ViaSetu_Shipping_Method extends WC_Shipping_Method {
    public function __construct( $instance_id = 0 ) {
        $this->id                 = 'viasetu_shipping';
        $this->instance_id        = absint( $instance_id );
        $this->method_title       = __( 'ViaSetu Shipping', 'viasetu-woocommerce' );
        $this->method_description = __( 'Live courier rates from your ViaSetu merchant account.', 'viasetu-woocommerce' );
        $this->supports           = array( 'shipping-zones', 'instance-settings' );
        $this->enabled            = ViaSetu_Settings::get( 'enabled' );
        $this->title              = ViaSetu_Settings::get( 'shipping_title', 'ViaSetu Shipping' );
    }

    public function calculate_shipping( $package = array() ) {
        $postcode = preg_replace( '/\D+/', '', (string) ( $package['destination']['postcode'] ?? '' ) );
        $pickup   = preg_replace( '/\D+/', '', (string) ViaSetu_Settings::get( 'pickup_pincode' ) );
        if ( 6 !== strlen( $postcode ) || 6 !== strlen( $pickup ) ) return;

        $weight = 0.0;
        foreach ( $package['contents'] ?? array() as $line ) {
            $product = $line['data'] ?? null;
            if ( $product && is_a( $product, 'WC_Product' ) ) {
                $weight += (float) wc_get_weight( $product->get_weight() ?: 0.1, 'kg' ) * max( 1, (int) ( $line['quantity'] ?? 1 ) );
            }
        }
        $box = array(
            'weight_kg' => max( 0.1, round( $weight, 3 ) ),
            'length_cm' => (float) ViaSetu_Settings::get( 'default_length', 20 ),
            'width_cm'  => (float) ViaSetu_Settings::get( 'default_width', 15 ),
            'height_cm' => (float) ViaSetu_Settings::get( 'default_height', 10 ),
        );
        $cache_key = 'viasetu_rate_' . md5( wp_json_encode( array( $pickup, $postcode, $box ) ) );
        $quotes    = get_transient( $cache_key );
        if ( false === $quotes ) {
            $response = ( new ViaSetu_Api_Client() )->rates( $pickup, $postcode, array( $box ) );
            if ( is_wp_error( $response ) ) return;
            $quotes = $response['quotes'] ?? array();
            set_transient( $cache_key, $quotes, 5 * MINUTE_IN_SECONDS );
        }

        $quote = is_array( $quotes ) && ! empty( $quotes ) ? reset( $quotes ) : null;
        if ( ! is_array( $quote ) || empty( $quote['total_amount'] ) ) return;
        $label = sprintf(
            '%s — %s (%s)',
            $this->title,
            sanitize_text_field( $quote['partner_name'] ?? 'Courier' ),
            sanitize_text_field( $quote['delivery_time'] ?? 'Estimated delivery' )
        );
        $this->add_rate(
            array(
                'id'        => $this->get_rate_id() . ':' . sanitize_key( $quote['partner_code'] ?? 'standard' ),
                'label'     => $label,
                'cost'      => (float) $quote['total_amount'],
                'meta_data' => array(
                    '_viasetu_partner_code' => sanitize_key( $quote['partner_code'] ?? '' ),
                    '_viasetu_service_code' => sanitize_text_field( $quote['service_code'] ?? '' ),
                ),
            )
        );
    }
}
