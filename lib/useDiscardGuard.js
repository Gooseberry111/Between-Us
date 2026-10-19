import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";

import { confirmDiscard } from "./actions";

/*
 * ==========================================
 * DISCARD GUARD
 * ==========================================
 *
 * While `dirty` is true, leaving the screen -- the back
 * button, Android's back gesture, swiping it away, the
 * close button -- asks first, so nothing typed is lost by
 * accident. Saving should make `dirty` false before it
 * navigates away.
 */
export function useDiscardGuard(dirty) {
  const navigation = useNavigation();

  usePreventRemove(Boolean(dirty), ({ data }) => {
    confirmDiscard(() => navigation.dispatch(data.action));
  });
}
