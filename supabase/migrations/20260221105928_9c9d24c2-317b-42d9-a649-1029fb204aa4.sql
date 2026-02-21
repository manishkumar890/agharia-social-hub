
CREATE POLICY "Subscriptions are viewable by everyone"
ON public.user_subscriptions
FOR SELECT
USING (true);
