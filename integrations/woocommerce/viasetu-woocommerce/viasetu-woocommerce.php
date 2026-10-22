<?php
/**
 * Plugin Name: ViaSetu for WooCommerce
 * Plugin URI: https://www.viasetu.com/developers/merchant-api
 * Description: ViaSetu shipping rates, shipment booking, tracking, labels and signed status webhooks for WooCommerce.
 * Version: 0.1.0
 * Requires at least: 6.3
 * Requires PHP: 7.4
 * WC requires at least: 8.0
 * Author: ViaSetu
 * Author URI: https://www.viasetu.com
 * Text Domain: viasetu-woocommerce
 */

defined( 'ABSPATH' ) || exit;

define( 'VIASETU_WC_VERSION', '0.1.0' );
define( 'VIASETU_WC_FILE', __FILE__ );
define( 'VIASETU_WC_DIR', plugin_dir_path( __FILE__ ) );

require_once VIASETU_WC_DIR . 'includes/class-viasetu-settings.php';
require_once VIASETU_WC_DIR . 'includes/class-viasetu-api-client.php';
require_once VIASETU_WC_DIR . 'includes/class-viasetu-webhooks.php';

function viasetu_wc_missing_woocommerce_notice() {
    echo '<div class="notice notice-error"><p>' . esc_html__( 'ViaSetu for WooCommerce requires WooCommerce to be installed and active.', 'viasetu-woocommerce' ) . '</p></div>';
}

function viasetu_wc_boot() {
    if ( ! class_exists( 'WooCommerce' ) || ! class_exists( 'WC_Shipping_Method' ) ) {
        add_action( 'admin_notices', 'viasetu_wc_missing_woocommerce_notice' );
        return;
    }

    require_once VIASETU_WC_DIR . 'includes/class-viasetu-shipping-method.php';
    require_once VIASETU_WC_DIR . 'includes/class-viasetu-order-actions.php';

    ViaSetu_Settings::init();
    ViaSetu_Webhooks::init();
    ViaSetu_Order_Actions::init();

    // Keep background tracking active after plugin updates as well as fresh activations.
    if ( ! wp_next_scheduled( 'viasetu_wc_tracking_sync' ) ) {
        wp_schedule_event( time() + HOUR_IN_SECONDS, 'hourly', 'viasetu_wc_tracking_sync' );
    }

    add_filter(
        'woocommerce_shipping_methods',
        static function ( $methods ) {
            $methods['viasetu_shipping'] = 'ViaSetu_Shipping_Method';
            return $methods;
        }
    );
}
add_action( 'plugins_loaded', 'viasetu_wc_boot', 20 );

function viasetu_wc_activate() {
    if ( ! wp_next_scheduled( 'viasetu_wc_tracking_sync' ) ) {
        wp_schedule_event( time() + HOUR_IN_SECONDS, 'hourly', 'viasetu_wc_tracking_sync' );
    }
}
register_activation_hook( __FILE__, 'viasetu_wc_activate' );

function viasetu_wc_deactivate() {
    wp_clear_scheduled_hook( 'viasetu_wc_tracking_sync' );
}
register_deactivation_hook( __FILE__, 'viasetu_wc_deactivate' );

add_action(
    'before_woocommerce_init',
    static function () {
        if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
            \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
        }
    }
);
