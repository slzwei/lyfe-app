import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

/** Valid Ionicons icon name */
export type IconName = ComponentProps<typeof Ionicons>['name'];
