CREATE POLICY "Admins can insert any subscription"
ON public.user_subscriptions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));