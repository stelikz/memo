# Scan from Book Feature

## What
Add a "Scan from book" option to the Add screen (`app/(tabs)/add.tsx`), matching wireframe `wireframe_02_add_word.html`.

## Wireframe spec
- Below the "Add card" button, add an "or" divider
- Then an outlined button with camera icon: "Scan from book" + subtitle "Point your camera at French text"
- Tapping it opens a camera/OCR screen

## Implementation steps

1. **Add UI to `add.tsx`**: "or" divider + "Scan from book" button below the existing `<Button>`, navigating to `/scan`
2. **Create `app/scan.tsx`**: camera screen with live text recognition
3. **Add dependencies**: `expo-camera` + OCR solution (e.g. `react-native-mlkit-ocr` or Google ML Kit)
4. **Add locale keys**: `scan_from_book`, `scan_subtitle`, etc. in `i18n/`
5. **Flow**: recognized text gets passed back to the add screen (word + sentence fields)
