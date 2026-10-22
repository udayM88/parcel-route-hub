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
        if ( 6 !== strlen( $postcode ) || 6 !== strlen( $pickup ) || ! ViaSetu_Product_Settings::cart_is_eligible( $package['contents'] ?? array() ) ) return;

        $box = $this->package_box( $package['contents'] ?? array() );
        $cache_key = 'viasetu_rate_' . md5( wp_json_encode( array( $pickup, $postcode, $box ) ) );
        $quotes    = get_transient( $cache_key );
        if ( false === $quotes ) {
            $response = ( new ViaSetu_Api_Client() )->rates( $pickup, $postcode, array( $box ) );
            if ( is_wp_error( $response ) ) {
                $this->add_fallback_rate();
                return;
            }
            $quotes = $response['quotes'] ?? array();
            set_transient( $cache_key, $quotes, 5 * MINUTE_IN_SECONDS );
        }

        if ( ! is_array( $quotes ) || ! $quotes ) {
            $this->add_fallback_rate();
            return;
        }
        $quotes = $this->sort_quotes( $quotes );
        $quotes = array_slice( $quotes, 0, (int) ViaSetu_Settings::get( 'max_quotes', 3 ) );
        foreach ( $quotes as $index => $quote ) {
            if ( ! is_array( $quote ) || ! isset( $quote['total_amount'] ) ) continue;
            $parts = array( $this->title );
            if ( 'yes' === ViaSetu_Settings::get( 'show_courier', 'yes' ) ) $parts[] = sanitize_text_field( $quote['partner_name'] ?? 'Courier' );
            $label = implode( ' — ', $parts );
            if ( 'yes' === ViaSetu_Settings::get( 'show_eta', 'yes' ) && ! empty( $quote['delivery_time'] ) ) $label .= ' (' . sanitize_text_field( $quote['delivery_time'] ) . ')';
            $this->add_rate(
                array(
                    'id'        => $this->get_rate_id() . ':' . sanitize_key( $quote['partner_code'] ?? 'standard' ) . ':' . sanitize_key( $quote['service_code'] ?? (string) $index ),
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

    private function package_box( $contents ) {
        $weight = 0.0;
        $length = 0.0;
        $width  = 0.0;
        $height = 0.0;
        foreach ( $contents as $line ) {
            $product = $line['data'] ?? null;
            if ( ! $product instanceof WC_Product ) continue;
            $quantity = max( 1, (int) ( $line['quantity'] ?? 1 ) );
            $weight  += (float) wc_get_weight( $product->get_weight() ?: 0.1, 'kg' ) * $quantity;
            $length   = max( $length, (float) wc_get_dimension( $product->get_length() ?: 0, 'cm' ) );
            $width    = max( $width, (float) wc_get_dimension( $product->get_width() ?: 0, 'cm' ) );
            $height  += (float) wc_get_dimension( $product->get_height() ?: 0, 'cm' ) * $quantity;
        }
        return array(
            'weight_kg' => max( 0.1, round( $weight, 3 ) ),
            'length_cm' => max( 1, min( 300, $length ?: (float) ViaSetu_Settings::get( 'default_length', 20 ) ) ),
            'width_cm'  => max( 1, min( 300, $width ?: (float) ViaSetu_Settings::get( 'default_width', 15 ) ) ),
            'height_cm' => max( 1, min( 300, $height ?: (float) ViaSetu_Settings::get( 'default_height', 10 ) ) ),
        );
    }

    private function sort_quotes( $quotes ) {
        $sort      = ViaSetu_Settings::get( 'quote_sort', 'price' );
        $preferred = array_filter( array_map( 'sanitize_key', array_map( 'trim', explode( ',', ViaSetu_Settings::get( 'preferred_partners', '' ) ) ) ) );
        usort(
            $quotes,
            static function ( $a, $b ) use ( $sort, $preferred ) {
                if ( 'fastest' === $sort ) {
                    preg_match( '/\d+/', (string) ( $a['delivery_time'] ?? '' ), $a_match );
                    preg_match( '/\d+/', (string) ( $b['delivery_time'] ?? '' ), $b_match );
                    $a_days = isset( $a_match[0] ) ? (int) $a_match[0] : 999;
                    $b_days = isset( $b_match[0] ) ? (int) $b_match[0] : 999;
                    if ( $a_days !== $b_days ) return $a_days <=> $b_days;
                }
                if ( 'preferred' === $sort ) {
                    $a_rank = array_search( sanitize_key( $a['partner_code'] ?? '' ), $preferred, true );
                    $b_rank = array_search( sanitize_key( $b['partner_code'] ?? '' ), $preferred, true );
                    $a_rank = false === $a_rank ? 999 : $a_rank;
                    $b_rank = false === $b_rank ? 999 : $b_rank;
                    if ( $a_rank !== $b_rank ) return $a_rank <=> $b_rank;
                }
                return (float) ( $a['total_amount'] ?? PHP_FLOAT_MAX ) <=> (float) ( $b['total_amount'] ?? PHP_FLOAT_MAX );
            }
        );
        return $quotes;
    }

    private function add_fallback_rate() {
        if ( 'yes' !== ViaSetu_Settings::get( 'fallback_enabled', 'no' ) ) return;
        $this->add_rate(
            array(
                'id'    => $this->get_rate_id() . ':fallback',
                'label' => $this->title . ' — ' . __( 'Standard fallback', 'viasetu-woocommerce' ),
                'cost'  => (float) ViaSetu_Settings::get( 'fallback_cost', 99 ),
            )
        );
    }
}
