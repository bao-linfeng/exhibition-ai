/**
 * Actor context represents the authenticated user making a request.
 */
export interface ActorContext {
  userId: string;
  role: string;
}
