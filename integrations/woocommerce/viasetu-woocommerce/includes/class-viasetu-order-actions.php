<?php
defined( 'ABSPATH' ) || exit;

final class ViaSetu_Order_Actions {
    public static function init() {
        add_filter( 'woocommerce_order_actions', array( __CLASS__, 'actions' ), 10, 2 );
        add_action( 'woocommerce_order_action_viasetu_create_shipment', array( __CLASS__, 'create' ) );
        add_action( 'woocommerce_order_action_viasetu_refresh_tracking', array( __CLASS__, 'refresh' ) );
        add_action( 'woocommerce_order_action_viasetu_fetch_label', array( __CLASS__, 'label' ) );
        add_action( 'woocommerce_order_status_changed', array( __CLASS__, 'maybe_auto_create' ), 10, 4 );
        add_action( 'woocommerce_order_status_cancelled', array( __CLASS__, 'cancel' ) );
        add_action( 'woocommerce_admin_order_data_after_shipping_address', array( __CLASS__, 'admin_details' ) );
        add_action( 'woocommerce_order_details_after_order_table', array( __CLASS__, 'customer_details' ) );
        add_action( 'viasetu_wc_tracking_sync', array( __CLASS__, 'sync_open_shipments' ) );
    }

    public static function actions( $actions, $order = null ) {
        if ( ! $order instanceof WC_Order ) return $actions;
        if ( $order->get_meta( '_viasetu_booking_id' ) ) {
            $actions['viasetu_refresh_tracking'] = __( 'ViaSetu: Refresh tracking', 'viasetu-woocommerce' );
            $actions['viasetu_fetch_label']      = __( 'ViaSetu: Fetch label', 'viasetu-woocommerce' );
        } else {
            $actions['viasetu_create_shipment'] = __( 'ViaSetu: Create shipment', 'viasetu-woocommerce' );
        }
        return $actions;
    }

    private static function address( $order, $prefix ) {
        $shipping = 'shipping' === $prefix;
        $get      = static function ( $field ) use ( $order, $shipping ) {
            $method = 'get_' . ( $shipping ? 'shipping_' : 'billing_' ) . $field;
            return is_callable( array( $order, $method ) ) ? (string) $order->$method() : '';
        };
        $first = $get( 'first_name' );
        $last  = $get( 'last_name' );
        $phone = $shipping && is_callable( array( $order, 'get_shipping_phone' ) ) ? $order->get_shipping_phone() : $order->get_billing_phone();
        return array(
            'name'    => trim( $first . ' ' . $last ) ?: $order->get_formatted_billing_full_name(),
            'phone'   => (string) $phone,
            'address' => trim( $get( 'address_1' ) . ' ' . $get( 'address_2' ) ),
            'city'    => $get( 'city' ),
            'state'   => $get( 'state' ),
            'pincode' => $get( 'postcode' ),
        );
    }

    private static function boxes( $order ) {
        $weight = 0.0;
        $length = 0.0;
        $width  = 0.0;
        $height = 0.0;
        foreach ( $order->get_items() as $item ) {
            $product = $item->get_product();
            if ( ! $product ) continue;
            $quantity = max( 1, $item->get_quantity() );
            $weight  += (float) wc_get_weight( $product->get_weight() ?: 0.1, 'kg' ) * $quantity;
            $length   = max( $length, (float) wc_get_dimension( $product->get_length() ?: 0, 'cm' ) );
            $width    = max( $width, (float) wc_get_dimension( $product->get_width() ?: 0, 'cm' ) );
            $height  += (float) wc_get_dimension( $product->get_height() ?: 0, 'cm' ) * $quantity;
        }
        return array(
            array(
                'weight_kg' => max( 0.1, round( $weight, 3 ) ),
                'length_cm' => max( 1, min( 300, $length ?: (float) ViaSetu_Settings::get( 'default_length', 20 ) ) ),
                'width_cm'  => max( 1, min( 300, $width ?: (float) ViaSetu_Settings::get( 'default_width', 15 ) ) ),
                'height_cm' => max( 1, min( 300, $height ?: (float) ViaSetu_Settings::get( 'default_height', 10 ) ) ),
            ),
        );
    }

    private static function goods_type( $order ) {
        $types   = array();
        $fragile = false;
        foreach ( $order->get_items() as $item ) {
            $product = $item->get_product();
            if ( ! $product ) continue;
            $type = sanitize_text_field( $product->get_meta( '_viasetu_goods_type', true ) );
            if ( ! $type && $product->get_parent_id() ) $type = sanitize_text_field( get_post_meta( $product->get_parent_id(), '_viasetu_goods_type', true ) );
            if ( $type ) $types[] = $type;
            $is_fragile = $product->get_meta( '_viasetu_fragile', true );
            if ( '' === $is_fragile && $product->get_parent_id() ) $is_fragile = get_post_meta( $product->get_parent_id(), '_viasetu_fragile', true );
            if ( 'yes' === $is_fragile ) $fragile = true;
        }
        $label = $types ? implode( ', ', array_unique( $types ) ) : ViaSetu_Settings::get( 'default_goods_type', 'Package' );
        return substr( $label . ( $fragile ? ' (Fragile)' : '' ), 0, 60 );
    }

    private static function selected_service( $order ) {
        foreach ( $order->get_items( 'shipping' ) as $shipping_item ) {
            $partner_code = sanitize_key( $shipping_item->get_meta( '_viasetu_partner_code', true ) );
            $service_code = sanitize_text_field( $shipping_item->get_meta( '_viasetu_service_code', true ) );
            if ( $partner_code ) {
                return array(
                    'partner_code' => $partner_code,
                    'service_code' => $service_code,
                );
            }
        }
        return array();
    }

    public static function create( $order ) {
        if ( ! $order instanceof WC_Order || $order->get_meta( '_viasetu_booking_id' ) ) return;
        $pickup = array(
            'name'    => ViaSetu_Settings::get( 'pickup_name' ),
            'phone'   => ViaSetu_Settings::get( 'pickup_phone' ),
            'address' => ViaSetu_Settings::get( 'pickup_address' ),
            'city'    => ViaSetu_Settings::get( 'pickup_city' ),
            'state'   => ViaSetu_Settings::get( 'pickup_state' ),
            'pincode' => ViaSetu_Settings::get( 'pickup_pincode' ),
        );
        $payload = array(
            'pickup'         => $pickup,
            'delivery'       => self::address( $order, $order->get_shipping_address_1() ? 'shipping' : 'billing' ),
            'boxes'          => self::boxes( $order ),
            'goods_type'     => self::goods_type( $order ),
            'declared_value' => (float) $order->get_total(),
        );
        $payload = array_merge( $payload, self::selected_service( $order ) );
        $result = ( new ViaSetu_Api_Client() )->create_shipment( $payload, 'wc-' . get_current_blog_id() . '-' . $order->get_id() . '-v1' );
        if ( is_wp_error( $result ) ) {
            $order->add_order_note( sprintf( __( 'ViaSetu shipment was not created: %s', 'viasetu-woocommerce' ), $result->get_error_message() ) );
            ViaSetu_Logger::log( 'error', 'Shipment creation failed', array( 'order_id' => $order->get_id(), 'error' => $result->get_error_message() ) );
            return;
        }
        $order->update_meta_data( '_viasetu_booking_id', sanitize_text_field( $result['booking_id'] ?? '' ) );
        $order->update_meta_data( '_viasetu_status', sanitize_text_field( $result['status'] ?? 'CREATED' ) );
        $order->update_meta_data( '_viasetu_courier', sanitize_text_field( $result['courier'] ?? '' ) );
        $awbs = array_filter( wp_list_pluck( $result['boxes'] ?? array(), 'awb' ) );
        $order->update_meta_data( '_viasetu_awb', implode( ', ', array_map( 'sanitize_text_field', $awbs ) ) );
        $order->save();
        $order->add_order_note( __( 'ViaSetu shipment created successfully.', 'viasetu-woocommerce' ) );
        ViaSetu_Logger::log( 'success', 'Shipment created', array( 'order_id' => $order->get_id(), 'booking_id' => $result['booking_id'] ?? '' ) );
    }

    public static function maybe_auto_create( $order_id, $from_status = '', $to_status = '', $order = null ) {
        if ( 'yes' !== ViaSetu_Settings::get( 'auto_create' ) ) return;
        if ( ! in_array( $to_status, (array) ViaSetu_Settings::get( 'auto_create_statuses', array( 'processing' ) ), true ) ) return;
        $order = $order instanceof WC_Order ? $order : wc_get_order( $order_id );
        if ( $order ) self::create( $order );
    }

    public static function refresh( $order ) {
        if ( ! $order instanceof WC_Order ) return false;
        $booking_id = $order->get_meta( '_viasetu_booking_id' );
        if ( ! $booking_id ) return false;
        $result = ( new ViaSetu_Api_Client() )->track( $booking_id );
        if ( is_wp_error( $result ) ) {
            $order->add_order_note( sprintf( __( 'ViaSetu tracking refresh failed: %s', 'viasetu-woocommerce' ), $result->get_error_message() ) );
            return false;
        }
        $before = (string) $order->get_meta( '_viasetu_status' );
        self::apply_status( $order, $result['status'] ?? '', $result['awb'] ?? '', 'api' );
        return $before !== (string) $order->get_meta( '_viasetu_status' ) ? true : null;
    }

    public static function label( $order ) {
        if ( ! $order instanceof WC_Order ) return;
        $booking_id = $order->get_meta( '_viasetu_booking_id' );
        if ( ! $booking_id ) return;
        $result = ( new ViaSetu_Api_Client() )->label( $booking_id );
        if ( is_wp_error( $result ) ) {
            $order->add_order_note( sprintf( __( 'ViaSetu label is unavailable: %s', 'viasetu-woocommerce' ), $result->get_error_message() ) );
            return;
        }
        $url = esc_url_raw( $result['label_url'] ?? '' );
        if ( $url ) {
            $order->update_meta_data( '_viasetu_label_url', $url );
            $order->save();
            $order->add_order_note( __( 'ViaSetu shipping label is ready.', 'viasetu-woocommerce' ) );
        }
    }

    public static function cancel( $order_id ) {
        $order = wc_get_order( $order_id );
        if ( ! $order ) return;
        $booking_id = $order->get_meta( '_viasetu_booking_id' );
        if ( ! $booking_id || 'CANCELLED' === strtoupper( (string) $order->get_meta( '_viasetu_status' ) ) ) return;
        $result = ( new ViaSetu_Api_Client() )->cancel( $booking_id, 'WooCommerce order cancelled' );
        if ( is_wp_error( $result ) ) {
            $order->add_order_note( sprintf( __( 'ViaSetu cancellation failed: %s', 'viasetu-woocommerce' ), $result->get_error_message() ) );
            return;
        }
        $order->update_meta_data( '_viasetu_status', 'CANCELLED' );
        $order->save();
        $order->add_order_note( __( 'ViaSetu shipment cancelled and wallet refund requested.', 'viasetu-woocommerce' ) );
    }

    public static function apply_status( $order, $status, $awb = '', $source = 'webhook' ) {
        $status = strtoupper( sanitize_text_field( $status ) );
        if ( '' === $status ) return;
        $before = (string) $order->get_meta( '_viasetu_status' );
        $order->update_meta_data( '_viasetu_status', $status );
        if ( $awb ) $order->update_meta_data( '_viasetu_awb', sanitize_text_field( $awb ) );
        $order->save();
        if ( $before !== $status ) $order->add_order_note( sprintf( __( 'ViaSetu status updated to %1$s via %2$s.', 'viasetu-woocommerce' ), $status, $source ) );
        if ( 'DELIVERED' === $status && 'yes' === ViaSetu_Settings::get( 'complete_when_delivered', 'yes' ) && $order->has_status( array( 'processing', 'on-hold' ) ) ) $order->update_status( 'completed', __( 'Delivered by ViaSetu.', 'viasetu-woocommerce' ) );
    }

    public static function sync_open_shipments() {
        $stats = array( 'checked' => 0, 'updated' => 0, 'failed' => 0 );
        $orders = wc_get_orders(
            array(
                'limit'      => (int) ViaSetu_Settings::get( 'sync_batch_size', 50 ),
                'status'     => array( 'wc-processing', 'wc-on-hold' ),
                'meta_key'   => '_viasetu_booking_id',
                'meta_compare' => 'EXISTS',
            )
        );
        foreach ( $orders as $order ) {
            $stats['checked']++;
            $updated = self::refresh( $order );
            if ( false === $updated ) $stats['failed']++;
            elseif ( true === $updated ) $stats['updated']++;
        }
        ViaSetu_Logger::log( 'debug', 'Tracking sync completed', $stats );
        return $stats;
    }

    public static function admin_details( $order ) {
        self::render_details( $order, true );
    }

    public static function customer_details( $order ) {
        self::render_details( $order, false );
    }

    private static function render_details( $order, $admin ) {
        if ( ! $order instanceof WC_Order || ! $order->get_meta( '_viasetu_booking_id' ) ) return;
        $label = $order->get_meta( '_viasetu_label_url' );
        echo '<section class="viasetu-shipment"><h3>' . esc_html__( 'ViaSetu shipment', 'viasetu-woocommerce' ) . '</h3>';
        echo '<p><strong>' . esc_html__( 'Status:', 'viasetu-woocommerce' ) . '</strong> ' . esc_html( $order->get_meta( '_viasetu_status' ) ?: 'Created' ) . '<br>';
        echo '<strong>' . esc_html__( 'AWB:', 'viasetu-woocommerce' ) . '</strong> ' . esc_html( $order->get_meta( '_viasetu_awb' ) ?: 'Pending' ) . '</p>';
        if ( $label ) echo '<p><a class="button" target="_blank" rel="noopener" href="' . esc_url( $label ) . '">' . esc_html__( 'Download shipping label', 'viasetu-woocommerce' ) . '</a></p>';
        if ( $admin ) echo '<p><small>' . esc_html( $order->get_meta( '_viasetu_booking_id' ) ) . '</small></p>';
        echo '</section>';
    }
}
