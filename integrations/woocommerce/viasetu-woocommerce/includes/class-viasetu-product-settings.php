<?php
defined( 'ABSPATH' ) || exit;

final class ViaSetu_Product_Settings {
    public static function init() {
        add_action( 'woocommerce_product_options_shipping', array( __CLASS__, 'fields' ) );
        add_action( 'woocommerce_process_product_meta', array( __CLASS__, 'save' ) );
        add_filter( 'woocommerce_available_payment_gateways', array( __CLASS__, 'payment_gateways' ) );
    }

    public static function fields() {
        echo '<div class="options_group"><p class="form-field"><strong>' . esc_html__( 'ViaSetu shipping rules', 'viasetu-woocommerce' ) . '</strong></p>';
        woocommerce_wp_checkbox(
            array(
                'id'          => '_viasetu_exclude',
                'label'       => __( 'Exclude from ViaSetu', 'viasetu-woocommerce' ),
                'description' => __( 'Hide ViaSetu checkout rates when this product is in the cart.', 'viasetu-woocommerce' ),
            )
        );
        woocommerce_wp_text_input(
            array(
                'id'          => '_viasetu_goods_type',
                'label'       => __( 'Goods type', 'viasetu-woocommerce' ),
                'placeholder' => __( 'Apparel, Electronics…', 'viasetu-woocommerce' ),
                'desc_tip'    => true,
                'description' => __( 'Used on the ViaSetu shipment. Leave empty to use the global default.', 'viasetu-woocommerce' ),
            )
        );
        woocommerce_wp_checkbox(
            array(
                'id'          => '_viasetu_fragile',
                'label'       => __( 'Fragile handling', 'viasetu-woocommerce' ),
                'description' => __( 'Marks this product as fragile in the merchant order note.', 'viasetu-woocommerce' ),
            )
        );
        echo '</div>';
    }

    public static function save( $product_id ) {
        if ( ! current_user_can( 'edit_post', $product_id ) ) return;
        update_post_meta( $product_id, '_viasetu_exclude', isset( $_POST['_viasetu_exclude'] ) ? 'yes' : 'no' );
        update_post_meta( $product_id, '_viasetu_fragile', isset( $_POST['_viasetu_fragile'] ) ? 'yes' : 'no' );
        if ( isset( $_POST['_viasetu_goods_type'] ) ) {
            update_post_meta( $product_id, '_viasetu_goods_type', sanitize_text_field( wp_unslash( $_POST['_viasetu_goods_type'] ) ) );
        }
    }

    public static function cart_is_eligible( $contents ) {
        foreach ( $contents as $line ) {
            $product = $line['data'] ?? null;
            if ( ! $product instanceof WC_Product ) continue;
            $excluded = $product->get_meta( '_viasetu_exclude', true );
            if ( '' === $excluded && $product->get_parent_id() ) $excluded = get_post_meta( $product->get_parent_id(), '_viasetu_exclude', true );
            if ( 'yes' === $excluded ) return false;
        }
        return true;
    }

    public static function package_box( $contents ) {
        $rows = array();
        foreach ( (array) $contents as $line ) {
            $product = $line['data'] ?? null;
            if ( $product instanceof WC_Product ) {
                $rows[] = array( 'product' => $product, 'quantity' => max( 1, absint( $line['quantity'] ?? 1 ) ) );
            }
        }
        return self::box_from_rows( $rows );
    }

    public static function order_box( $order ) {
        if ( ! $order instanceof WC_Order ) return new WP_Error( 'viasetu_invalid_order', __( 'The WooCommerce order is invalid.', 'viasetu-woocommerce' ) );
        $rows = array();
        foreach ( $order->get_items() as $item ) {
            $product = $item->get_product();
            if ( $product instanceof WC_Product ) {
                $rows[] = array( 'product' => $product, 'quantity' => max( 1, absint( $item->get_quantity() ) ) );
            }
        }
        return self::box_from_rows( $rows );
    }

    private static function box_from_rows( $rows ) {
        $weight = 0.0;
        $length = 0.0;
        $width  = 0.0;
        $height = 0.0;
        $missing = array();

        foreach ( $rows as $row ) {
            $product = $row['product'];
            if ( $product->is_virtual() ) continue;
            $quantity = $row['quantity'];
            $raw_weight = $product->get_weight();
            $raw_length = $product->get_length();
            $raw_width  = $product->get_width();
            $raw_height = $product->get_height();
            $values = array(
                'weight' => '' === $raw_weight ? 0.0 : (float) wc_get_weight( (float) $raw_weight, 'kg' ),
                'length' => '' === $raw_length ? 0.0 : (float) wc_get_dimension( (float) $raw_length, 'cm' ),
                'width'  => '' === $raw_width ? 0.0 : (float) wc_get_dimension( (float) $raw_width, 'cm' ),
                'height' => '' === $raw_height ? 0.0 : (float) wc_get_dimension( (float) $raw_height, 'cm' ),
            );
            $missing_fields = array();
            foreach ( $values as $field => $value ) if ( $value <= 0 ) $missing_fields[] = $field;
            if ( $missing_fields ) {
                $missing[] = sprintf( '%1$s (%2$s)', wp_strip_all_tags( $product->get_name() ), implode( ', ', $missing_fields ) );
                continue;
            }
            $weight += $values['weight'] * $quantity;
            $length  = max( $length, $values['length'] );
            $width   = max( $width, $values['width'] );
            $height += $values['height'] * $quantity;
        }

        if ( $missing ) {
            return new WP_Error(
                'viasetu_product_shipping_data_missing',
                sprintf(
                    /* translators: %s: product names and missing shipping fields. */
                    __( 'Add real WooCommerce weight and dimensions before booking: %s.', 'viasetu-woocommerce' ),
                    implode( '; ', array_slice( $missing, 0, 5 ) )
                )
            );
        }
        if ( $weight <= 0 || $length <= 0 || $width <= 0 || $height <= 0 ) {
            return new WP_Error( 'viasetu_empty_parcel', __( 'This order does not contain a shippable product with weight and dimensions.', 'viasetu-woocommerce' ) );
        }
        if ( $weight > 100 || $length > 300 || $width > 300 || $height > 300 ) {
            return new WP_Error( 'viasetu_parcel_limits', __( 'The combined parcel exceeds the ViaSetu single-box limit (100 kg or 300 cm). Split it before booking.', 'viasetu-woocommerce' ) );
        }
        return array(
            'weight_kg' => round( $weight, 3 ),
            'length_cm' => round( $length, 2 ),
            'width_cm'  => round( $width, 2 ),
            'height_cm' => round( $height, 2 ),
        );
    }

    public static function payment_gateways( $gateways ) {
        if ( is_admin() || 'no' !== ViaSetu_Settings::get( 'enable_cod', 'yes' ) || ! WC()->session ) return $gateways;
        $chosen = (array) WC()->session->get( 'chosen_shipping_methods', array() );
        foreach ( $chosen as $method ) {
            if ( 0 === strpos( (string) $method, 'viasetu_shipping' ) ) {
                unset( $gateways['cod'] );
                break;
            }
        }
        return $gateways;
    }
}
