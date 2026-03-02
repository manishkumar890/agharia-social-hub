-- Allow admins to view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON public.user_subscriptions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for user_subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_subscriptions;