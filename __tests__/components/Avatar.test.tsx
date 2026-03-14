/**
 * Tests for components/Avatar.tsx — Avatar with image or initials fallback
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import Avatar from '@/components/Avatar';

describe('Avatar', () => {
    it('renders initial when no avatarUrl', () => {
        const { getByText } = render(<Avatar name="Alice" size={40} backgroundColor="#ccc" textColor="#fff" />);
        expect(getByText('A')).toBeTruthy();
    });

    it('renders uppercase initial from lowercase name', () => {
        const { getByText } = render(<Avatar name="bob" size={40} backgroundColor="#ccc" textColor="#fff" />);
        expect(getByText('B')).toBeTruthy();
    });

    it('renders ? for empty name', () => {
        const { getByText } = render(<Avatar name="" size={40} backgroundColor="#ccc" textColor="#fff" />);
        expect(getByText('?')).toBeTruthy();
    });

    it('renders image when avatarUrl provided', () => {
        const { queryByText, toJSON } = render(
            <Avatar
                name="Alice"
                avatarUrl="https://avatar.com/a.jpg"
                size={40}
                backgroundColor="#ccc"
                textColor="#fff"
            />,
        );
        // No initial text when image is shown
        expect(queryByText('A')).toBeNull();
        // Should have an Image component
        const tree = toJSON() as any;
        expect(tree.type).toBe('ExpoImage');
    });

    it('applies custom size to container', () => {
        const { toJSON } = render(<Avatar name="C" size={60} backgroundColor="#abc" textColor="#000" />);
        const tree = toJSON() as any;
        const style = Array.isArray(tree.props.style) ? Object.assign({}, ...tree.props.style) : tree.props.style;
        expect(style.width).toBe(60);
        expect(style.height).toBe(60);
        expect(style.borderRadius).toBe(30);
    });

    it('shows initial when null avatarUrl', () => {
        const { getByText } = render(
            <Avatar name="Zoe" avatarUrl={null} size={40} backgroundColor="#ccc" textColor="#fff" />,
        );
        expect(getByText('Z')).toBeTruthy();
    });
});
