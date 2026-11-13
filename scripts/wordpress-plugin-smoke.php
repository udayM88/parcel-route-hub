<?php
/**
 * Runtime assertions for `wp eval-file` inside a disposable WordPress site.
 *
 * Set VIASETU_SMOKE_MODE to `production` or `demo` before running.
 */

if ( ! defined( 'ABSPATH' ) ) {
	throw new RuntimeException( 'WordPress is not loaded.' );
}

$mode = getenv( 'VIASETU_SMOKE_MODE' ) ?: 'production';
if ( ! in_array( $mode, array( 'production', 'demo' ), true ) ) {
	throw new RuntimeException( 'VIASETU_SMOKE_MODE must be production or demo.' );
}

wp_set_current_user( 1 );

$blocked_http_requests = 0;
if ( 'demo' === $mode ) {
	add_filter(
		'pre_http_request',
		static function () use ( &$blocked_http_requests ) {
			$blocked_http_requests++;
			return new WP_Error( 'viasetu_smoke_http_blocked', 'Demo smoke test blocked an outbound HTTP request.' );
		},
		10,
		3
	);
}

$_GET['tab'] = 'demo' === $mode ? 'dashboard' : 'connection';
ob_start();
ViaSetu_Admin::render();
$admin_html = ob_get_clean();

if ( ! did_action( 'rest_api_init' ) ) {
	do_action( 'rest_api_init' );
}

$routes           = rest_get_server()->get_routes();
$shipping_methods = apply_filters( 'woocommerce_shipping_methods', array() );
$is_demo          = defined( 'VIASETU_WC_DEMO_MODE' ) && VIASETU_WC_DEMO_MODE;
$checks           = array(
	'admin_class'     => class_exists( 'ViaSetu_Admin' ),
	'connect_class'   => class_exists( 'ViaSetu_Connect' ),
	'api_class'       => class_exists( 'ViaSetu_Api_Client' ),
	'admin_title'     => false !== strpos( $admin_html, 'ViaSetu Merchant' ),
	'shipping_method' => isset( $shipping_methods['viasetu_shipping'] ),
	'webhook_route'   => isset( $routes['/viasetu/v1/webhook'] ),
	'encryption'      => ViaSetu_Settings::encryption_available(),
	'cron'            => (bool) wp_next_scheduled( 'viasetu_wc_tracking_sync' ),
	'demo_constant'   => 'demo' === $mode ? $is_demo : ! $is_demo,
);

if ( 'demo' === $mode ) {
	$client                    = new ViaSetu_Api_Client();
	$demo_dashboard            = $client->dashboard();
	$demo_billing              = $client->billing();
	$demo_shipment             = $client->create_shipment( array(), 'wc-smoke-demo-1' );
	$checks['connected']       = ViaSetu_Settings::is_connected();
	$checks['sample_metrics']  = false !== strpos( $admin_html, 'All shipments' )
		&& false !== strpos( $admin_html, '>128<' );
	$checks['sample_wallet']   = false !== strpos( $admin_html, '12,450.75' );
	$checks['sandbox_badge']   = false !== strpos( $admin_html, 'Sandbox demo' );
	$checks['local_dashboard'] = ! is_wp_error( $demo_dashboard ) && ! empty( $demo_dashboard['demo'] );
	$checks['local_billing']   = ! is_wp_error( $demo_billing ) && ! empty( $demo_billing['demo'] );
	$checks['local_shipment']  = ! is_wp_error( $demo_shipment ) && ! empty( $demo_shipment['demo'] );
	$checks['no_outbound_http'] = 0 === $blocked_http_requests;
} else {
	$checks['disconnected']    = ! ViaSetu_Settings::is_connected();
	$checks['connect_button']  = false !== strpos( $admin_html, 'Sign in and connect' );
	$checks['apply_button']    = false !== strpos( $admin_html, 'Create / apply for account' );
	$checks['manual_recovery'] = false !== strpos( $admin_html, 'Advanced manual API-key setup' );

	$api_key        = 'vs_test_' . str_repeat( '0', 48 );
	$webhook_secret = str_repeat( 'd', 64 );
	$stored          = ViaSetu_Settings::store_connection(
		$api_key,
		$webhook_secret,
		'smoke-connection',
		'sandbox',
		array( 'company_name' => 'Smoke Test Merchant', 'email' => 'smoke@example.test' )
	);
	$checks['credential_roundtrip'] = $stored
		&& hash_equals( $api_key, ViaSetu_Settings::api_key() )
		&& hash_equals( $webhook_secret, ViaSetu_Settings::webhook_secret() );

	$order = wc_create_order();
	$order->update_meta_data( '_viasetu_booking_id', '00000000-0000-4000-8000-000000000001' );
	$order->update_meta_data( '_viasetu_status', 'CREATED' );
	$order->save();
	$payload   = wp_json_encode(
		array(
			'data' => array(
				'object' => array(
					'booking_id' => '00000000-0000-4000-8000-000000000001',
					'status'     => 'IN_TRANSIT',
					'awb'        => 'VS-SMOKE-1001',
				),
			),
		)
	);
	$timestamp = (string) time();
	$signature = 'sha256=' . hash_hmac( 'sha256', $timestamp . '.' . $payload, $webhook_secret );
	$request   = new WP_REST_Request( 'POST', '/viasetu/v1/webhook' );
	$request->set_body( $payload );
	$request->set_header( 'x-viasetu-timestamp', $timestamp );
	$request->set_header( 'x-viasetu-signature', $signature );
	$request->set_header( 'x-viasetu-delivery', 'smoke-delivery-1' );
	$first_response     = ViaSetu_Webhooks::receive( $request );
	$duplicate_response = ViaSetu_Webhooks::receive( $request );
	$order              = wc_get_order( $order->get_id() );
	$duplicate_data     = $duplicate_response->get_data();
	$checks['signed_webhook'] = 200 === $first_response->get_status()
		&& 'IN_TRANSIT' === $order->get_meta( '_viasetu_status' )
		&& 'VS-SMOKE-1001' === $order->get_meta( '_viasetu_awb' );
	$checks['webhook_deduplication'] = 200 === $duplicate_response->get_status()
		&& ! empty( $duplicate_data['duplicate'] );
	$order->delete( true );
	ViaSetu_Settings::clear_connection();
}

foreach ( $checks as $name => $passed ) {
	if ( ! $passed ) {
		throw new RuntimeException( 'ViaSetu smoke check failed: ' . $name );
	}
}

echo wp_json_encode(
	array(
		'mode'        => $mode,
		'wordpress'   => get_bloginfo( 'version' ),
		'woocommerce' => defined( 'WC_VERSION' ) ? WC_VERSION : null,
		'php'         => PHP_VERSION,
		'checks'      => $checks,
	),
	JSON_PRETTY_PRINT
);
