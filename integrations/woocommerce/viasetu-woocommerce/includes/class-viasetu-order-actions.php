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
        add_action( 'viasetu_wc_retry_booking', array( __CLASS__, 'retry_booking' ) );
        add_action( 'viasetu_wc_fetch_label', array( __CLASS__, 'fetch_label_later' ) );
    }

    public static function actions( $actions, $order = null ) {
        if ( ! $order instanceof WC_Order ) return $actions;
        if ( $order->get_meta( '_viasetu_booking_id' ) ) {
            $actions['viasetu_refresh_tracking'] = __( 'ViaSetu: Refresh tracking', 'viasetu-woocommerce' );
            $actions['viasetu_fetch_label']      = __( 'ViaSetu: Fetch label', 'viasetu-woocommerce' );
        } elseif ( self::uses_viasetu_shipping( $order ) ) {
            $actions['viasetu_create_shipment'] = $order->get_meta( '_viasetu_booking_error' )
                ? __( 'ViaSetu: Retry shipment', 'viasetu-woocommerce' )
                : __( 'ViaSetu: Create shipment', 'viasetu-woocommerce' );
        }
        return $actions;
    }

    public static function uses_viasetu_shipping( $order ) {
        if ( ! $order instanceof WC_Order ) return false;
        foreach ( $order->get_items( 'shipping' ) as $shipping_item ) {
            if ( 'viasetu_shipping' === sanitize_key( $shipping_item->get_method_id() ) ) return true;
        }
        return false;
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
            'phone'   => substr( preg_replace( '/\D+/', '', (string) $phone ), -10 ),
            'address' => trim( $get( 'address_1' ) . ' ' . $get( 'address_2' ) ),
            'city'    => $get( 'city' ),
            'state'   => $get( 'state' ),
            'pincode' => preg_replace( '/\D+/', '', $get( 'postcode' ) ),
        );
    }

    private static function validate_party( $party, $label ) {
        foreach ( array( 'name', 'address', 'city', 'state' ) as $field ) {
            if ( strlen( trim( (string) ( $party[ $field ] ?? '' ) ) ) < 2 ) {
                return new WP_Error( 'viasetu_delivery_missing', sprintf( __( '%1$s %2$s is required.', 'viasetu-woocommerce' ), $label, $field ) );
            }
        }
        if ( ! preg_match( '/^\d{10}$/', (string) ( $party['phone'] ?? '' ) ) ) {
            return new WP_Error( 'viasetu_delivery_phone', sprintf( __( '%s phone must contain 10 digits.', 'viasetu-woocommerce' ), $label ) );
        }
        if ( ! preg_match( '/^\d{6}$/', (string) ( $party['pincode'] ?? '' ) ) ) {
            return new WP_Error( 'viasetu_delivery_pincode', sprintf( __( '%s pincode must contain 6 digits.', 'viasetu-woocommerce' ), $label ) );
        }
        return true;
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
            if ( 'viasetu_shipping' !== sanitize_key( $shipping_item->get_method_id() ) ) continue;
            $partner_code = sanitize_key( $shipping_item->get_meta( '_viasetu_partner_code', true ) );
            $service_code = sanitize_text_field( $shipping_item->get_meta( '_viasetu_service_code', true ) );
            if ( $partner_code ) return array( 'partner_code' => $partner_code, 'service_code' => $service_code );
        }
        return array();
    }

    private static function preflight( $order ) {
        if ( ! self::uses_viasetu_shipping( $order ) ) {
            return new WP_Error( 'viasetu_wrong_shipping_method', __( 'Shipment was not created because the customer did not select ViaSetu Shipping.', 'viasetu-woocommerce' ) );
        }
        if ( ! ViaSetu_Settings::is_connected() ) {
            return new WP_Error( 'viasetu_not_configured', __( 'Connect a complete, environment-matched ViaSetu API key before booking.', 'viasetu-woocommerce' ) );
        }
        $pickup_errors = ViaSetu_Settings::pickup_errors();
        if ( $pickup_errors ) return new WP_Error( 'viasetu_pickup_incomplete', implode( ' ', $pickup_errors ) );

        $delivery = self::address( $order, $order->get_shipping_address_1() ? 'shipping' : 'billing' );
        $valid_delivery = self::validate_party( $delivery, __( 'Delivery', 'viasetu-woocommerce' ) );
        if ( is_wp_error( $valid_delivery ) ) return $valid_delivery;

        $box = ViaSetu_Product_Settings::order_box( $order );
        if ( is_wp_error( $box ) ) return $box;
        if ( (float) $order->get_total() <= 0 ) return new WP_Error( 'viasetu_declared_value', __( 'Order total must be greater than zero before booking.', 'viasetu-woocommerce' ) );

        return array( 'delivery' => $delivery, 'box' => $box );
    }

    public static function create( $order, $context = 'manual' ) {
        if ( ! $order instanceof WC_Order ) return new WP_Error( 'viasetu_invalid_order', __( 'The WooCommerce order is invalid.', 'viasetu-woocommerce' ) );
        if ( $order->get_meta( '_viasetu_booking_id' ) ) return true;

        $preflight = self::preflight( $order );
        if ( is_wp_error( $preflight ) ) {
            self::record_blocked( $order, $preflight, $context );
            return $preflight;
        }

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
            'delivery'       => $preflight['delivery'],
            'boxes'          => array( $preflight['box'] ),
            'goods_type'     => self::goods_type( $order ),
            'declared_value' => (float) $order->get_total(),
        );
        $payload = array_merge( $payload, self::selected_service( $order ) );

        $attempts = absint( $order->get_meta( '_viasetu_booking_attempts' ) ) + 1;
        $order->update_meta_data( '_viasetu_booking_attempts', $attempts );
        $order->update_meta_data( '_viasetu_last_attempt_at', current_time( 'mysql', true ) );
        $order->update_meta_data( '_viasetu_booking_state', 'requesting' );
        $order->save();

        // This stable key protects retries and lost responses from duplicate wallet charges/bookings.
        $result = ( new ViaSetu_Api_Client() )->create_shipment( $payload, 'wc-' . get_current_blog_id() . '-' . $order->get_id() . '-v1' );
        if ( is_wp_error( $result ) ) {
            self::record_failure( $order, $result, $context );
            return $result;
        }

        $booking_id = sanitize_text_field( $result['booking_id'] );
        $order->update_meta_data( '_viasetu_booking_id', $booking_id );
        $order->update_meta_data( '_viasetu_status', sanitize_text_field( $result['status'] ?? 'CREATED' ) );
        $order->update_meta_data( '_viasetu_courier', sanitize_text_field( $result['courier'] ?? '' ) );
        $awbs = array_filter( wp_list_pluck( is_array( $result['boxes'] ?? null ) ? $result['boxes'] : array(), 'awb' ) );
        $order->update_meta_data( '_viasetu_awb', implode( ', ', array_map( 'sanitize_text_field', $awbs ) ) );
        $order->update_meta_data( '_viasetu_booking_state', 'booked' );
        $order->delete_meta_data( '_viasetu_booking_error' );
        $order->delete_meta_data( '_viasetu_booking_error_code' );
        $order->delete_meta_data( '_viasetu_next_retry_at' );
        $order->save();
        wp_clear_scheduled_hook( 'viasetu_wc_retry_booking', array( $order->get_id() ) );

        $order->add_order_note( sprintf( __( 'ViaSetu shipment created successfully. Booking ID: %s', 'viasetu-woocommerce' ), $booking_id ) );
        ViaSetu_Logger::log( 'success', 'Shipment created', array( 'order_id' => $order->get_id(), 'booking_id' => $booking_id ) );
        if ( 'yes' === ViaSetu_Settings::get( 'label_auto_fetch', 'yes' ) ) {
            wp_schedule_single_event( time() + 2 * MINUTE_IN_SECONDS, 'viasetu_wc_fetch_label', array( $order->get_id() ) );
        }
        return true;
    }

    private static function record_blocked( $order, $error, $context ) {
        $message = $error->get_error_message();
        $previous = (string) $order->get_meta( '_viasetu_booking_error' );
        $order->update_meta_data( '_viasetu_booking_state', 'blocked' );
        $order->update_meta_data( '_viasetu_booking_error', $message );
        $order->update_meta_data( '_viasetu_booking_error_code', $error->get_error_code() );
        $order->delete_meta_data( '_viasetu_next_retry_at' );
        $order->save();
        if ( $previous !== $message && 'auto' !== $context ) {
            $order->add_order_note( sprintf( __( 'ViaSetu booking blocked: %s', 'viasetu-woocommerce' ), $message ) );
        }
        ViaSetu_Logger::log( 'warning', 'Shipment preflight blocked', array( 'order_id' => $order->get_id(), 'code' => $error->get_error_code(), 'context' => $context ) );
    }

    private static function record_failure( $order, $error, $context ) {
        $message = $error->get_error_message();
        $order->update_meta_data( '_viasetu_booking_state', 'failed' );
        $order->update_meta_data( '_viasetu_booking_error', $message );
        $order->update_meta_data( '_viasetu_booking_error_code', $error->get_error_code() );
        $order->save();
        $order->add_order_note( sprintf( __( 'ViaSetu shipment was not created: %s', 'viasetu-woocommerce' ), $message ) );
        ViaSetu_Logger::log( 'error', 'Shipment creation failed', array( 'order_id' => $order->get_id(), 'error' => $message, 'context' => $context ) );
        if ( self::should_retry( $error ) ) self::schedule_retry( $order );
    }

    private static function should_retry( $error ) {
        if ( 'yes' !== ViaSetu_Settings::get( 'booking_retry_enabled', 'yes' ) ) return false;
        if ( in_array( $error->get_error_code(), array( 'viasetu_wallet_setup_pending', 'viasetu_insufficient_balance', 'viasetu_unauthorized', 'viasetu_forbidden' ), true ) ) return false;
        $data   = $error->get_error_data();
        $status = is_array( $data ) ? absint( $data['status'] ?? 0 ) : 0;
        if ( 0 === $status ) return true;
        return in_array( $status, array( 408, 409, 425, 429 ), true ) || $status >= 500;
    }

    private static function schedule_retry( $order ) {
        $attempts = absint( $order->get_meta( '_viasetu_booking_attempts' ) );
        $limit    = max( 1, absint( ViaSetu_Settings::get( 'booking_retry_limit', 3 ) ) );
        if ( $attempts >= $limit || $order->has_status( array( 'cancelled', 'refunded', 'failed' ) ) ) return;
        $delays = array( 15 * MINUTE_IN_SECONDS, HOUR_IN_SECONDS, 6 * HOUR_IN_SECONDS, DAY_IN_SECONDS );
        $delay  = $delays[ min( max( 0, $attempts - 1 ), count( $delays ) - 1 ) ];
        $next   = time() + $delay;
        $args   = array( $order->get_id() );
        wp_clear_scheduled_hook( 'viasetu_wc_retry_booking', $args );
        wp_schedule_single_event( $next, 'viasetu_wc_retry_booking', $args );
        $order->update_meta_data( '_viasetu_next_retry_at', $next );
        $order->save();
    }

    public static function retry_booking( $order_id ) {
        $order = wc_get_order( absint( $order_id ) );
        if ( ! $order instanceof WC_Order || $order->get_meta( '_viasetu_booking_id' ) ) return false;
        if ( $order->has_status( array( 'cancelled', 'refunded', 'failed' ) ) ) return false;
        return self::create( $order, 'retry' );
    }

    public static function maybe_auto_create( $order_id, $from_status = '', $to_status = '', $order = null ) {
        if ( 'yes' !== ViaSetu_Settings::get( 'auto_create' ) ) return;
        if ( ! in_array( $to_status, (array) ViaSetu_Settings::get( 'auto_create_statuses', array( 'processing' ) ), true ) ) return;
        $order = $order instanceof WC_Order ? $order : wc_get_order( $order_id );
        if ( $order instanceof WC_Order && self::uses_viasetu_shipping( $order ) ) self::create( $order, 'auto' );
    }

    public static function recover_eligible_orders( $limit = 50 ) {
        $stats = array( 'checked' => 0, 'created' => 0, 'failed' => 0, 'skipped' => 0 );
        $statuses = array_map( static function ( $status ) { return 'wc-' . $status; }, (array) ViaSetu_Settings::get( 'auto_create_statuses', array( 'processing' ) ) );
        $orders = wc_get_orders( array( 'limit' => max( 1, min( 200, absint( $limit ) ) ), 'status' => $statuses, 'orderby' => 'date', 'order' => 'ASC' ) );
        foreach ( $orders as $order ) {
            $stats['checked']++;
            if ( $order->get_meta( '_viasetu_booking_id' ) || ! self::uses_viasetu_shipping( $order ) ) { $stats['skipped']++; continue; }
            $result = self::create( $order, 'recovery' );
            if ( is_wp_error( $result ) ) $stats['failed']++;
            else $stats['created']++;
        }
        return $stats;
    }

    private static function retry_due_failures( $limit ) {
        $stats = array( 'retried' => 0, 'retry_failed' => 0 );
        $orders = wc_get_orders(
            array(
                'limit'      => max( 1, absint( $limit ) ),
                'status'     => array( 'wc-processing', 'wc-on-hold', 'wc-pending', 'wc-completed' ),
                'meta_query' => array(
                    array( 'key' => '_viasetu_booking_state', 'value' => 'failed' ),
                    array( 'key' => '_viasetu_next_retry_at', 'value' => time(), 'compare' => '<=', 'type' => 'NUMERIC' ),
                ),
            )
        );
        foreach ( $orders as $order ) {
            $stats['retried']++;
            if ( is_wp_error( self::retry_booking( $order->get_id() ) ) ) $stats['retry_failed']++;
        }
        return $stats;
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

    public static function fetch_label_later( $order_id ) {
        $order = wc_get_order( absint( $order_id ) );
        if ( $order instanceof WC_Order && ! $order->get_meta( '_viasetu_label_url' ) ) self::label( $order );
    }

    public static function cancel( $order_id ) {
        $order = wc_get_order( $order_id );
        if ( ! $order ) return;
        wp_clear_scheduled_hook( 'viasetu_wc_retry_booking', array( $order->get_id() ) );
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
        $limit = (int) ViaSetu_Settings::get( 'sync_batch_size', 50 );
        $stats = array_merge( array( 'checked' => 0, 'updated' => 0, 'failed' => 0 ), self::retry_due_failures( $limit ) );
        $orders = wc_get_orders(
            array(
                'limit'        => $limit,
                'status'       => array( 'wc-processing', 'wc-on-hold' ),
                'meta_key'     => '_viasetu_booking_id',
                'meta_compare' => 'EXISTS',
            )
        );
        foreach ( $orders as $order ) {
            if ( ! $order->get_meta( '_viasetu_booking_id' ) ) continue;
            $stats['checked']++;
            $updated = self::refresh( $order );
            if ( false === $updated ) $stats['failed']++;
            elseif ( true === $updated ) $stats['updated']++;
        }
        ViaSetu_Logger::log( 'debug', 'Tracking and retry sync completed', $stats );
        return $stats;
    }

    public static function admin_details( $order ) {
        self::render_details( $order, true );
    }

    public static function customer_details( $order ) {
        self::render_details( $order, false );
    }

    private static function render_details( $order, $admin ) {
        if ( ! $order instanceof WC_Order ) return;
        $booking_id = $order->get_meta( '_viasetu_booking_id' );
        $error      = $order->get_meta( '_viasetu_booking_error' );
        if ( ! $booking_id && ( ! $admin || ! $error ) ) return;
        $label = $order->get_meta( '_viasetu_label_url' );
        echo '<section class="viasetu-shipment"><h3>' . esc_html__( 'ViaSetu shipment', 'viasetu-woocommerce' ) . '</h3>';
        if ( $error && ! $booking_id ) echo '<p><strong>' . esc_html__( 'Booking issue:', 'viasetu-woocommerce' ) . '</strong> ' . esc_html( $error ) . '</p>';
        if ( $booking_id ) {
            echo '<p><strong>' . esc_html__( 'Status:', 'viasetu-woocommerce' ) . '</strong> ' . esc_html( $order->get_meta( '_viasetu_status' ) ?: 'Created' ) . '<br>';
            echo '<strong>' . esc_html__( 'AWB:', 'viasetu-woocommerce' ) . '</strong> ' . esc_html( $order->get_meta( '_viasetu_awb' ) ?: 'Pending' ) . '</p>';
            if ( $label ) echo '<p><a class="button" target="_blank" rel="noopener" href="' . esc_url( $label ) . '">' . esc_html__( 'Download shipping label', 'viasetu-woocommerce' ) . '</a></p>';
            if ( $admin ) echo '<p><small>' . esc_html( $booking_id ) . '</small></p>';
        }
        echo '</section>';
    }
}
