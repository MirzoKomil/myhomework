import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius, touchTarget } from '@/constants/v2/tokens';
import { EyeIcon } from './Icons';
import { V2Text } from './Text';

type InputProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Parol maydoni: ko'rsatish/yashirish tugmasi qo'shiladi. */
  secure?: boolean;
  error?: string;
};

export function Input({ label, secure, error, ...rest }: InputProps) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <V2Text variant="bodySmall" style={styles.label}>
        {label}
      </V2Text>
      <View>
        <TextInput
          {...rest}
          accessibilityLabel={label}
          secureTextEntry={secure && hidden}
          placeholderTextColor={colors.textSubtle}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={[
            styles.input,
            secure && styles.inputWithButton,
            focused && styles.focused,
            !!error && styles.errored,
          ]}
        />
        {secure && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Parolni ko'rsatish" : 'Parolni yashirish'}
            onPress={() => setHidden((h) => !h)}
            style={styles.eye}
          >
            <EyeIcon />
          </Pressable>
        )}
      </View>
      {!!error && (
        <V2Text variant="caption" color={colors.dangerText} accessibilityLiveRegion="polite">
          {error}
        </V2Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  label: { fontFamily: fonts.bodyBold },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  inputWithButton: { paddingRight: 52 },
  focused: { borderColor: colors.cobalt },
  errored: { borderColor: colors.danger },
  eye: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
