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

function viasetu_smoke_order( $product, $method_id = 'viasetu_shipping' ) {
	$order = wc_create_order();
	$order->add_product( $product, 1 );
	$address = array(
		'first_name' => 'Smoke', 'last_name' => 'Customer', 'phone' => '9876543210',
		'address_1' => '12 Test Road', 'city' => 'Mumbai', 'state' => 'MH', 'postcode' => '400001', 'country' => 'IN',
	);
	$order->set_address( $address, 'billing' );
	$order->set_address( $address, 'shipping' );
	$shipping = new WC_Order_Item_Shipping();
	$shipping->set_method_title( 'viasetu_shipping' === $method_id ? 'ViaSetu Shipping' : 'Free shipping' );
	$shipping->set_method_id( $method_id );
	$shipping->set_total( 50 );
	if ( 'viasetu_shipping' === $method_id ) {
		$shipping->add_meta_data( '_viasetu_partner_code', 'delhivery' );
		$shipping->add_meta_data( '_viasetu_service_code', 'surface' );
	}
	$order->add_item( $shipping );
	$order->calculate_totals();
	$order->save();
	return $order;
}

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

	$settings = ViaSetu_Settings::get_all();
	$settings['pickup_name'] = 'Smoke Warehouse';
	$settings['pickup_phone'] = '9876543210';
	$settings['pickup_address'] = '44 Warehouse Road';
	$settings['pickup_city'] = 'Pune';
	$settings['pickup_state'] = 'MH';
	$settings['pickup_pincode'] = '411001';
	$settings['auto_create'] = 'yes';
	$settings['auto_create_statuses'] = array( 'processing' );
	$settings['booking_retry_enabled'] = 'yes';
	$settings['booking_retry_limit'] = '3';
	update_option( ViaSetu_Settings::OPTION, $settings, false );
	$checks['pickup_validation'] = ViaSetu_Settings::pickup_is_complete();
	$checks['key_format_validation'] = ViaSetu_Settings::api_key_is_valid( $api_key, 'sandbox' )
		&& ! ViaSetu_Settings::api_key_is_valid( 'vs_test_short', 'sandbox' )
		&& ! ViaSetu_Settings::api_key_is_valid( $api_key, 'live' );

	$good_product = new WC_Product_Simple();
	$good_product->set_name( 'Smoke Parcel' );
	$good_product->set_regular_price( '799' );
	$good_product->set_weight( '0.75' );
	$good_product->set_length( '20' );
	$good_product->set_width( '15' );
	$good_product->set_height( '10' );
	$good_product->save();
	$bad_product = new WC_Product_Simple();
	$bad_product->set_name( 'Incomplete Parcel' );
	$bad_product->set_regular_price( '499' );
	$bad_product->save();

	$api_mode = 'success';
	$api_requests = 0;
	$api_filter = static function ( $preempt, $args, $url ) use ( &$api_mode, &$api_requests ) {
		if ( false === strpos( $url, '/merchant-api' ) ) return $preempt;
		$api_requests++;
		if ( 'unauthorized' === $api_mode ) {
			$status = 401;
			$body = array( 'success' => false, 'error' => array( 'code' => 'unauthorized', 'message' => 'Missing or malformed API key' ) );
		} elseif ( 'missing_booking' === $api_mode ) {
			$status = 201;
			$body = array( 'success' => true, 'status' => 'CREATED' );
		} elseif ( 'temporary' === $api_mode ) {
			$status = 503;
			$body = array( 'success' => false, 'error' => array( 'code' => 'temporarily_unavailable', 'message' => 'Try again later' ) );
		} else {
			$status = 201;
			$body = array( 'success' => true, 'booking_id' => '00000000-0000-4000-8000-000000000099', 'status' => 'CREATED', 'courier' => 'Delhivery', 'boxes' => array( array( 'awb' => 'DLV-SMOKE-99' ) ) );
		}
		return array( 'headers' => array(), 'body' => wp_json_encode( $body ), 'response' => array( 'code' => $status, 'message' => 'Smoke' ), 'cookies' => array(), 'filename' => null );
	};
	add_filter( 'pre_http_request', $api_filter, 10, 3 );

	$test_orders = array();
	$free_order = viasetu_smoke_order( $good_product, 'free_shipping' );
	$test_orders[] = $free_order;
	$before_free = $api_requests;
	ViaSetu_Order_Actions::maybe_auto_create( $free_order->get_id(), 'pending', 'processing', $free_order );
	$free_order = wc_get_order( $free_order->get_id() );
	$checks['free_shipping_never_auto_books'] = $before_free === $api_requests
		&& ! $free_order->get_meta( '_viasetu_booking_id' )
		&& ! $free_order->get_meta( '_viasetu_booking_error' );

	$incomplete_order = viasetu_smoke_order( $bad_product );
	$test_orders[] = $incomplete_order;
	$before_incomplete = $api_requests;
	$incomplete_result = ViaSetu_Order_Actions::create( $incomplete_order, 'smoke' );
	$checks['missing_product_data_blocks_request'] = is_wp_error( $incomplete_result )
		&& 'viasetu_product_shipping_data_missing' === $incomplete_result->get_error_code()
		&& $before_incomplete === $api_requests;

	$api_mode = 'missing_booking';
	$missing_booking_order = viasetu_smoke_order( $good_product );
	$test_orders[] = $missing_booking_order;
	$missing_booking_result = ViaSetu_Order_Actions::create( $missing_booking_order, 'smoke' );
	$missing_booking_order = wc_get_order( $missing_booking_order->get_id() );
	$checks['missing_booking_id_is_failure'] = is_wp_error( $missing_booking_result )
		&& 'viasetu_invalid_booking_response' === $missing_booking_result->get_error_code()
		&& ! $missing_booking_order->get_meta( '_viasetu_booking_id' );
	wp_clear_scheduled_hook( 'viasetu_wc_retry_booking', array( $missing_booking_order->get_id() ) );

	$api_mode = 'unauthorized';
	$unauthorized_order = viasetu_smoke_order( $good_product );
	$test_orders[] = $unauthorized_order;
	$unauthorized_result = ViaSetu_Order_Actions::create( $unauthorized_order, 'smoke' );
	$unauthorized_order = wc_get_order( $unauthorized_order->get_id() );
	$checks['unauthorized_is_not_retried'] = is_wp_error( $unauthorized_result )
		&& 'viasetu_unauthorized' === $unauthorized_result->get_error_code()
		&& ! $unauthorized_order->get_meta( '_viasetu_next_retry_at' );

	$api_mode = 'temporary';
	$temporary_order = viasetu_smoke_order( $good_product );
	$test_orders[] = $temporary_order;
	$temporary_result = ViaSetu_Order_Actions::create( $temporary_order, 'smoke' );
	$temporary_order = wc_get_order( $temporary_order->get_id() );
	$checks['temporary_failure_is_scheduled'] = is_wp_error( $temporary_result )
		&& (int) $temporary_order->get_meta( '_viasetu_next_retry_at' ) > time();
	wp_clear_scheduled_hook( 'viasetu_wc_retry_booking', array( $temporary_order->get_id() ) );

	$api_mode = 'success';
	$success_order = viasetu_smoke_order( $good_product );
	$test_orders[] = $success_order;
	$success_result = ViaSetu_Order_Actions::create( $success_order, 'smoke' );
	$success_order = wc_get_order( $success_order->get_id() );
	$checks['valid_response_books_once'] = true === $success_result
		&& '00000000-0000-4000-8000-000000000099' === $success_order->get_meta( '_viasetu_booking_id' )
		&& 'DLV-SMOKE-99' === $success_order->get_meta( '_viasetu_awb' );
	remove_filter( 'pre_http_request', $api_filter, 10 );

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
	foreach ( $test_orders as $test_order ) {
		$fresh_order = wc_get_order( $test_order->get_id() );
		if ( $fresh_order ) $fresh_order->delete( true );
	}
	wp_delete_post( $good_product->get_id(), true );
	wp_delete_post( $bad_product->get_id(), true );
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
