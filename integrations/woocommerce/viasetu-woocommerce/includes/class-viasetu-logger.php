<?php
defined( 'ABSPATH' ) || exit;

final class ViaSetu_Logger {
    const OPTION = 'viasetu_wc_logs';

    public static function log( $level, $message, $context = array() ) {
        $level = sanitize_key( $level );
        if ( 'debug' === $level && 'yes' !== ViaSetu_Settings::get( 'debug_logging', 'no' ) ) return;

        $logs   = get_option( self::OPTION, array() );
        $logs   = is_array( $logs ) ? $logs : array();
        $logs[] = array(
            'time'    => current_time( 'mysql' ),
            'level'   => $level ?: 'info',
            'message' => sanitize_text_field( $message ),
            'context' => self::redact( $context ),
        );
        update_option( self::OPTION, array_slice( $logs, -100 ), false );
    }

    public static function all() {
        $logs = get_option( self::OPTION, array() );
        return is_array( $logs ) ? array_reverse( $logs ) : array();
    }

    public static function clear() {
        delete_option( self::OPTION );
    }

    private static function redact( $value, $key = '' ) {
        if ( preg_match( '/key|secret|token|authorization|password/i', (string) $key ) ) return '[redacted]';
        if ( ! is_array( $value ) ) return is_scalar( $value ) ? sanitize_text_field( (string) $value ) : '';
        $clean = array();
        foreach ( $value as $item_key => $item ) $clean[ $item_key ] = self::redact( $item, $item_key );
        return $clean;
    }
}
