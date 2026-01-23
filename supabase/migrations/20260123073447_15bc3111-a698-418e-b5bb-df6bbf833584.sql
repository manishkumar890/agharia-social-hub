-- Allow admins to update any user subscription
CREATE POLICY "Admins can update any subscription"
ON public.user_subscriptions FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));