<?php
/**
 * Plugin Name: ViaSetu Merchant for WooCommerce
 * Plugin URI: https://www.viasetu.com/developers/merchant-api
 * Description: ViaSetu shipping rates, shipment booking, tracking, labels and signed status webhooks for WooCommerce.
 * Version: 1.0.0
 * Requires at least: 6.3
 * Requires PHP: 7.4
 * WC requires at least: 8.0
 * WC tested up to: 11.3
 * Author: ViaSetu
 * Author URI: https://www.viasetu.com
 * Text Domain: viasetu-woocommerce
 */

defined( 'ABSPATH' ) || exit;

if ( defined( 'VIASETU_WC_FILE' ) ) {
    add_action(
        'admin_notices',
        static function () {
            echo '<div class="notice notice-warning"><p>' . esc_html__( 'Another ViaSetu WooCommerce package is already active. Keep only the production or demo package active, not both.', 'viasetu-woocommerce' ) . '</p></div>';
        }
    );
    return;
}

define( 'VIASETU_WC_VERSION', '1.0.0' );
define( 'VIASETU_WC_FILE', __FILE__ );
define( 'VIASETU_WC_DIR', plugin_dir_path( __FILE__ ) );
if ( ! defined( 'VIASETU_WC_DEMO_MODE' ) ) define( 'VIASETU_WC_DEMO_MODE', false );

require_once VIASETU_WC_DIR . 'includes/class-viasetu-settings.php';
require_once VIASETU_WC_DIR . 'includes/class-viasetu-logger.php';
require_once VIASETU_WC_DIR . 'includes/class-viasetu-api-client.php';
require_once VIASETU_WC_DIR . 'includes/class-viasetu-webhooks.php';
require_once VIASETU_WC_DIR . 'includes/class-viasetu-connect.php';

if ( ! function_exists( 'viasetu_wc_boot' ) ) {
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
    require_once VIASETU_WC_DIR . 'includes/class-viasetu-product-settings.php';
    require_once VIASETU_WC_DIR . 'includes/class-viasetu-admin.php';

    ViaSetu_Settings::init();
    ViaSetu_Connect::init();
    ViaSetu_Webhooks::init();
    ViaSetu_Order_Actions::init();
    ViaSetu_Product_Settings::init();
    ViaSetu_Admin::init();

    // Keep background tracking active after plugin updates as well as fresh activations.
    if ( ! wp_next_scheduled( 'viasetu_wc_tracking_sync' ) ) {
        $interval = ViaSetu_Settings::get( 'sync_interval', 'hourly' );
        wp_schedule_event( time() + HOUR_IN_SECONDS, $interval, 'viasetu_wc_tracking_sync' );
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
    viasetu_wc_reschedule_sync( ViaSetu_Settings::get( 'sync_interval', 'hourly' ) );
    set_transient( 'viasetu_wc_activation_redirect', 1, 60 );
}
register_activation_hook( __FILE__, 'viasetu_wc_activate' );

function viasetu_wc_deactivate() {
    wp_clear_scheduled_hook( 'viasetu_wc_tracking_sync' );
}
register_deactivation_hook( __FILE__, 'viasetu_wc_deactivate' );

function viasetu_wc_cron_schedules( $schedules ) {
    $schedules['viasetu_15_minutes'] = array(
        'interval' => 15 * MINUTE_IN_SECONDS,
        'display'  => __( 'Every 15 minutes (ViaSetu)', 'viasetu-woocommerce' ),
    );
    return $schedules;
}
add_filter( 'cron_schedules', 'viasetu_wc_cron_schedules' );

function viasetu_wc_reschedule_sync( $interval = 'hourly' ) {
    $allowed  = array( 'viasetu_15_minutes', 'hourly', 'twicedaily' );
    $interval = in_array( $interval, $allowed, true ) ? $interval : 'hourly';
    wp_clear_scheduled_hook( 'viasetu_wc_tracking_sync' );
    wp_schedule_event( time() + MINUTE_IN_SECONDS, $interval, 'viasetu_wc_tracking_sync' );
}

add_action(
    'before_woocommerce_init',
    static function () {
        if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
            \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
        }
    }
);
}
