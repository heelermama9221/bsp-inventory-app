import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";

/**
 * Persists state to AsyncStorage. Works like useState but survives app restarts.
 * @param key     Unique AsyncStorage key for this piece of data
 * @param initial Default value when no persisted data exists yet
 */
export function useStorage<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const isFirstSave = useRef(true);

  useEffect(() => {
    AsyncStorage.getItem(key).then((raw) => {
      if (raw !== null) {
        try {
          setValue(JSON.parse(raw));
        } catch {
          // Corrupted data — fall back to initial
        }
      }
      setLoaded(true);
    });
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    if (isFirstSave.current) {
      isFirstSave.current = false;
      return;
    }
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  }, [key, value, loaded]);

  return [value, setValue, loaded];
}
