CREATE OR REPLACE FUNCTION public.generate_canonical_url(content_type text, content_slug text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE content_type
    WHEN 'post'    THEN 'https://www.viasetu.com/blog/' || content_slug
    WHEN 'page'    THEN 'https://www.viasetu.com/p/' || content_slug
    WHEN 'partner' THEN 'https://www.viasetu.com/courier/' || content_slug
    WHEN 'faq'     THEN 'https://www.viasetu.com/faq'
    ELSE               'https://www.viasetu.com/' || content_slug
  END;
$function$;

UPDATE public.cms_content SET canonical_url = public.generate_canonical_url(type::text, slug) WHERE canonical_url LIKE 'https://www.viasetu.com%';