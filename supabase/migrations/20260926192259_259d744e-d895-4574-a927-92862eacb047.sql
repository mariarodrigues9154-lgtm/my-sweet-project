ALTER TABLE public.products
  ADD CONSTRAINT products_price_positive CHECK (price > 0),
  ADD CONSTRAINT products_previous_price_gte CHECK (previous_price >= price),
  ADD CONSTRAINT products_stock_nonneg CHECK (stock >= 0),
  ADD CONSTRAINT products_rating_range CHECK (rating >= 0 AND rating <= 5),
  ADD CONSTRAINT products_counts_nonneg CHECK (reviews_count >= 0 AND sold_count >= 0),
  ADD CONSTRAINT products_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT products_name_len CHECK (char_length(btrim(name)) >= 2 AND char_length(btrim(title)) >= 2),
  ADD CONSTRAINT products_json_shapes CHECK (
    jsonb_typeof(media)='array' AND jsonb_typeof(variants)='array' AND jsonb_typeof(specs)='array'
    AND jsonb_typeof(description)='array' AND jsonb_typeof(creator_videos)='array' AND jsonb_typeof(reviews)='array'
    AND jsonb_typeof(offer)='object' AND jsonb_typeof(shipping)='object' AND jsonb_typeof(protection)='object'
    AND jsonb_typeof(sections)='object'
    AND jsonb_array_length(creator_videos) <= 7 AND jsonb_array_length(media) <= 20
  );