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
