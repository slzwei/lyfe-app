import CalendarPicker from '@/components/CalendarPicker';
import AttendeePickerModal from '@/components/events/AttendeePickerModal';
import EventTypeSelector from '@/components/events/EventTypeSelector';
import MapPicker from '@/components/events/MapPicker';
import RoadshowSettingsForm from '@/components/events/RoadshowSettingsForm';
import TimePickerModal from '@/components/events/TimePickerModal';
import { getRoadshowColors } from '@/constants/roadshow/tokens';
import { TropicFonts } from '@/constants/roadshow/typography';
import { ERROR_BG, ERROR_TEXT } from '@/constants/ui';
import { useTheme } from '@/contexts/ThemeContext';
import { useEventForm } from '@/hooks/useEventForm';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import { dateDiffDays, formatDateLabel, isValidDate } from '@/lib/dateTime';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateEventScreen() {
    const { colors, resolved } = useTheme();
    const stage = getRoadshowColors(resolved);
    const { isSubmitting: isGuardSubmitting, guard } = useSubmitGuard();
    const form = useEventForm();
    const [showMapPicker, setShowMapPicker] = useState(false);

    const handleConfirmPin = useCallback(
        (payload: { latitude: number; longitude: number; name?: string }) => {
            form.setLatitude(payload.latitude);
            form.setLongitude(payload.longitude);
            // The selected place name IS the Location on the event.
            // Location can ONLY be set through this flow — there is no
            // free-text input on the form. If the user dropped a pin
            // without selecting a suggestion (pure pan), `payload.name`
            // will be undefined and we leave the text as-is — but the
            // map itself currently always resolves a name from the
            // Places search, so this is effectively always set.
            if (payload.name) {
                form.setLocation(payload.name);
            }
            setShowMapPicker(false);
        },
        [form],
    );

    const handleClearPin = useCallback(() => {
        // The location text IS the pin, so clearing drops all three.
        form.setLatitude(null);
        form.setLongitude(null);
        form.setLocation('');
    }, [form]);

    const {
        isEditing,
        isEditingRoadshow,
        loadingEvent,
        submitting,
        errors,
        title,
        setTitle,
        eventType,
        setEventType,
        eventDate,
        setEventDate,
        showDatePicker,
        setShowDatePicker,
        location,
        setLocation,
        latitude,
        setLatitude,
        longitude,
        setLongitude,
        description,
        setDescription,
        timePicker,
        attendeePicker,
        roadshowCfg,
        handleSubmit,
        handleClearError,
        handleCloseAttendeePicker,
        handleAddExternal,
        handleRemoveAttendee,
        handleUpdateExternalRole,
        handleRemoveExternal,
        router,
    } = form;

    const {
        startHour,
        startMinIdx,
        startAmPm,
        endHour,
        endMinIdx,
        endAmPm,
        hasEndTime,
        showTimePicker,
        setStartHour,
        setStartMinIdx,
        setStartAmPm,
        setEndHour,
        setEndMinIdx,
        setEndAmPm,
        setHasEndTime,
        setShowTimePicker,
        formatStart,
        formatEnd,
    } = timePicker;

    const {
        selectedAttendees,
        showAttendeePicker,
        setShowAttendeePicker,
        pickerTab,
        setPickerTab,
        userSearch,
        setUserSearch,
        loadingUsers,
        usersError,
        filteredUsers,
        externalAttendees,
        externalName,
        setExternalName,
        externalRole,
        setExternalRole,
        loadUsers,
        toggleAttendee,
        updateAttendeeRole,
    } = attendeePicker;

    const {
        rsStartDate,
        setRsStartDate,
        rsEndDate,
        setRsEndDate,
        rsWeeklyCost,
        setRsWeeklyCost,
        rsSlots,
        setRsSlots,
        rsGrace,
        setRsGrace,
        rsSitdowns,
        setRsSitdowns,
        rsPitches,
        setRsPitches,
        rsClosed,
        setRsClosed,
        rsConfigLocked,
    } = roadshowCfg;

    const inputStyle = [
        styles.input,
        { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.textPrimary },
    ];
    const labelStyle = [styles.label, { color: colors.textSecondary }];

    const titleText = isEditing ? 'Edit Event' : 'Create Event';
    const ctaLabel = isEditing
        ? 'Save'
        : eventType === 'roadshow' &&
            rsStartDate &&
            rsEndDate &&
            isValidDate(rsStartDate) &&
            isValidDate(rsEndDate) &&
            rsEndDate >= rsStartDate
          ? `Publish ${dateDiffDays(rsStartDate, rsEndDate) + 1}`
          : 'Publish event';

    const renderTopBar = () => (
        <View style={[styles.topBar, { borderBottomColor: colors.hairline }]}>
            <TouchableOpacity
                onPress={() => router.back()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Cancel"
            >
                <Text style={[styles.topBarSide, { color: colors.textTertiary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.topBarTitle, { color: colors.textPrimary }]}>{titleText}</Text>
            <TouchableOpacity
                testID="event-create-save"
                onPress={() => guard(handleSubmit)}
                disabled={submitting || isGuardSubmitting}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Save event"
            >
                {submitting || isGuardSubmitting ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                    <Text style={[styles.topBarSide, { color: colors.accent, fontFamily: TropicFonts.uiSemiBold }]}>
                        Save
                    </Text>
                )}
            </TouchableOpacity>
        </View>
    );

    if (loadingEvent) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                {renderTopBar()}
                <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {renderTopBar()}

            <KeyboardAwareScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Type eyebrow ── */}
                <Text style={[styles.sectionEyebrow, { color: colors.textTertiary }]}>TYPE</Text>
                <EventTypeSelector eventType={eventType} onSelect={setEventType} disabled={isEditingRoadshow} />

                {/* ── Basics — title + date + time + venue ── */}
                <Text style={[styles.sectionEyebrow, { color: colors.textTertiary, marginTop: 18 }]}>BASICS</Text>
                <View
                    style={[
                        styles.basicsCard,
                        { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                    ]}
                >
                    {/* Title */}
                    <View style={styles.basicsRow}>
                        <Text style={[styles.basicsLabel, { color: colors.textTertiary }]}>Name</Text>
                        <TextInput
                            testID="event-create-title"
                            style={[
                                styles.basicsInput,
                                {
                                    color: colors.textPrimary,
                                    opacity: isEditingRoadshow ? 0.5 : 1,
                                },
                                errors.title && { color: colors.danger },
                            ]}
                            placeholder="Event title"
                            placeholderTextColor={colors.textTertiary}
                            value={title}
                            onChangeText={(t) => {
                                setTitle(t);
                                handleClearError('title');
                            }}
                            editable={!isEditingRoadshow}
                            textAlign="right"
                        />
                    </View>
                    {errors.title ? (
                        <Text style={[styles.errorText, { color: colors.danger, paddingHorizontal: 14 }]}>
                            {errors.title}
                        </Text>
                    ) : null}

                    {/* Date — single for non-roadshow & roadshow-edit; range for new roadshow */}
                    {(() => {
                        const isRoadshow = eventType === 'roadshow';
                        const showRange = isRoadshow && !isEditing;
                        const dateValue = showRange
                            ? rsStartDate && rsEndDate
                                ? `${formatDateLabel(rsStartDate)} – ${formatDateLabel(rsEndDate)}`
                                : 'Pick range'
                            : eventDate
                              ? formatDateLabel(eventDate)
                              : 'Pick date';
                        const errKey = showRange ? errors.rsStartDate || errors.rsEndDate : errors.eventDate;
                        return (
                            <>
                                <View style={[styles.basicsDivider, { backgroundColor: colors.hairline }]} />
                                <Pressable
                                    onPress={() => {
                                        if (isEditingRoadshow) return;
                                        setShowDatePicker(showRange ? 'range' : 'single');
                                    }}
                                    disabled={isEditingRoadshow}
                                    style={({ pressed }) => [
                                        styles.basicsRow,
                                        { opacity: isEditingRoadshow ? 0.55 : pressed ? 0.7 : 1 },
                                    ]}
                                    accessibilityLabel={showRange ? 'Pick date range' : 'Pick event date'}
                                >
                                    <Text style={[styles.basicsLabel, { color: colors.textTertiary }]}>Date</Text>
                                    <View style={styles.basicsValueRow}>
                                        <Text
                                            style={[
                                                styles.basicsValue,
                                                { color: errKey ? colors.danger : colors.textPrimary },
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {dateValue}
                                        </Text>
                                        {!isEditingRoadshow ? (
                                            <Text style={[styles.basicsArrow, { color: colors.textTertiary }]}>→</Text>
                                        ) : null}
                                    </View>
                                </Pressable>
                                {errKey ? (
                                    <Text style={[styles.errorText, { color: colors.danger, paddingHorizontal: 14 }]}>
                                        {errKey}
                                    </Text>
                                ) : null}
                            </>
                        );
                    })()}

                    {/* Time — Start row, plus End row when added */}
                    <View style={[styles.basicsDivider, { backgroundColor: colors.hairline }]} />
                    <Pressable
                        onPress={() => setShowTimePicker('start')}
                        style={({ pressed }) => [styles.basicsRow, { opacity: pressed ? 0.7 : 1 }]}
                        accessibilityLabel="Pick start time"
                        testID="event-create-start-time"
                    >
                        <Text style={[styles.basicsLabel, { color: colors.textTertiary }]}>
                            {hasEndTime ? 'Start' : 'Time'}
                        </Text>
                        <View style={styles.basicsValueRow}>
                            <Text style={[styles.basicsValue, { color: colors.textPrimary }]} numberOfLines={1}>
                                {formatStart()}
                            </Text>
                            <Text style={[styles.basicsArrow, { color: colors.textTertiary }]}>→</Text>
                        </View>
                    </Pressable>

                    {hasEndTime ? (
                        <>
                            <View style={[styles.basicsDivider, { backgroundColor: colors.hairline }]} />
                            <Pressable
                                onPress={() => setShowTimePicker('end')}
                                style={({ pressed }) => [styles.basicsRow, { opacity: pressed ? 0.7 : 1 }]}
                                accessibilityLabel="Pick end time"
                                testID="event-create-end-time"
                            >
                                <Text style={[styles.basicsLabel, { color: colors.textTertiary }]}>End</Text>
                                <View style={styles.basicsValueRow}>
                                    <Text style={[styles.basicsValue, { color: colors.textPrimary }]} numberOfLines={1}>
                                        {formatEnd()}
                                    </Text>
                                    <Text style={[styles.basicsArrow, { color: colors.textTertiary }]}>→</Text>
                                </View>
                            </Pressable>
                        </>
                    ) : (
                        <Pressable
                            onPress={() => {
                                setHasEndTime(true);
                                setShowTimePicker('end');
                            }}
                            style={styles.basicsSubAction}
                            hitSlop={8}
                        >
                            <Text style={[styles.basicsSubActionText, { color: colors.accent }]}>+ Add end time</Text>
                        </Pressable>
                    )}
                    {errors.endTime ? (
                        <Text style={[styles.errorText, { color: colors.danger, paddingHorizontal: 14 }]}>
                            {errors.endTime}
                        </Text>
                    ) : null}

                    {/* Venue */}
                    <View style={[styles.basicsDivider, { backgroundColor: colors.hairline }]} />
                    <Pressable
                        onPress={() => setShowMapPicker(true)}
                        style={({ pressed }) => [styles.basicsRow, { opacity: pressed ? 0.7 : 1 }]}
                        accessibilityLabel={latitude != null ? 'Edit venue' : 'Pick venue'}
                        testID="event-create-pin-location"
                    >
                        <Text style={[styles.basicsLabel, { color: colors.textTertiary }]}>Venue</Text>
                        <View style={styles.basicsValueRow}>
                            <Text
                                style={[
                                    styles.basicsValue,
                                    {
                                        color: location ? colors.textPrimary : colors.textTertiary,
                                    },
                                ]}
                                numberOfLines={1}
                            >
                                {location || 'Tap to pick'}
                            </Text>
                            {latitude != null ? <Ionicons name="location" size={14} color={colors.accent} /> : null}
                            <Text style={[styles.basicsArrow, { color: colors.textTertiary }]}>→</Text>
                        </View>
                    </Pressable>
                    {latitude != null ? (
                        <View style={styles.basicsSubRow}>
                            <Text style={[styles.basicsSubText, { color: colors.textTertiary }]}>
                                Pinned — check-in enabled
                            </Text>
                            <Pressable onPress={handleClearPin} hitSlop={8} testID="event-create-clear-pin">
                                <Text style={[styles.basicsSubActionText, { color: colors.danger }]}>Clear</Text>
                            </Pressable>
                        </View>
                    ) : null}
                </View>

                {/* ── Roadshow config — highlighted per prototype ── */}
                {eventType === 'roadshow' && (
                    <View
                        style={[
                            styles.highlightFrame,
                            {
                                backgroundColor: colors.tintTerra + 'AA',
                                borderColor: stage.live + '44',
                            },
                        ]}
                    >
                        <Text style={[styles.sectionEyebrow, { color: stage.live, marginBottom: 4 }]}>
                            ROADSHOW CONFIG
                        </Text>
                        <RoadshowSettingsForm
                            rsWeeklyCost={rsWeeklyCost}
                            onWeeklyCostChange={setRsWeeklyCost}
                            rsSlots={rsSlots}
                            onSlotsChange={setRsSlots}
                            rsGrace={rsGrace}
                            onGraceChange={setRsGrace}
                            rsSitdowns={rsSitdowns}
                            onSitdownsChange={setRsSitdowns}
                            rsPitches={rsPitches}
                            onPitchesChange={setRsPitches}
                            rsClosed={rsClosed}
                            onClosedChange={setRsClosed}
                            rsConfigLocked={rsConfigLocked}
                            errors={errors}
                            onClearError={handleClearError}
                        />
                    </View>
                )}

                {errors._submit ? (
                    <View style={[styles.submitError, { backgroundColor: ERROR_BG }]}>
                        <Text style={{ color: ERROR_TEXT, fontSize: 13 }}>{errors._submit}</Text>
                    </View>
                ) : null}

                {/* ── Description eyebrow ── */}
                <Text style={[styles.sectionEyebrow, { color: colors.textTertiary, marginTop: 18 }]}>DESCRIPTION</Text>
                <View style={styles.field}>
                    <TextInput
                        style={[inputStyle, styles.textArea]}
                        placeholder="Optional details..."
                        placeholderTextColor={colors.textTertiary}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                </View>

                {/* ── Invites eyebrow ── */}
                <Text style={[styles.sectionEyebrow, { color: colors.textTertiary, marginTop: 18 }]}>INVITES</Text>
                {(() => {
                    const totalAttendees = selectedAttendees.length + externalAttendees.length;
                    const everyone: readonly unknown[] = [...selectedAttendees, ...externalAttendees];
                    const roleCounts = everyone.reduce<Record<string, number>>((acc, raw) => {
                        const a = raw as { attendeeRole?: string; role?: string };
                        const r = a.attendeeRole ?? a.role ?? 'attendee';
                        acc[r] = (acc[r] ?? 0) + 1;
                        return acc;
                    }, {});
                    const roleLabels: Record<string, string> = {
                        host: 'host',
                        duty_manager: 'duty manager',
                        presenter: 'presenter',
                        attendee: 'agent',
                    };
                    const breakdown = Object.entries(roleCounts)
                        .filter(([, n]) => n > 0)
                        .map(([r, n]) => {
                            const label = roleLabels[r] ?? r;
                            return n === 1 ? `1 ${label}` : `${n} ${label}s`;
                        })
                        .join(', ');

                    return (
                        <Pressable
                            onPress={() => setShowAttendeePicker(true)}
                            style={({ pressed }) => [
                                styles.invitesCard,
                                {
                                    backgroundColor: colors.cardBackground,
                                    borderColor: colors.cardBorder,
                                    opacity: pressed ? 0.75 : 1,
                                },
                            ]}
                            accessibilityLabel="Manage invites"
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.invitesCount, { color: colors.textPrimary }]}>
                                    {totalAttendees === 0
                                        ? 'No attendees yet'
                                        : `${totalAttendees} attendee${totalAttendees === 1 ? '' : 's'}`}
                                </Text>
                                {breakdown ? (
                                    <Text style={[styles.invitesBreakdown, { color: colors.textTertiary }]}>
                                        {breakdown}
                                    </Text>
                                ) : (
                                    <Text style={[styles.invitesBreakdown, { color: colors.textTertiary }]}>
                                        Tap Manage to invite staff & externals
                                    </Text>
                                )}
                            </View>
                            <Text
                                style={[
                                    styles.invitesManage,
                                    { color: colors.accent, fontFamily: TropicFonts.uiSemiBold },
                                ]}
                            >
                                Manage →
                            </Text>
                        </Pressable>
                    );
                })()}

                <View style={{ height: 80 }} />
            </KeyboardAwareScrollView>

            {/* Sticky CTA */}
            <View style={[styles.stickyCtaWrap, { backgroundColor: colors.background }]}>
                <TouchableOpacity
                    testID="event-create-publish"
                    onPress={() => guard(handleSubmit)}
                    disabled={submitting || isGuardSubmitting}
                    style={[
                        styles.publishCta,
                        {
                            backgroundColor: colors.accent,
                            opacity: submitting || isGuardSubmitting ? 0.5 : 1,
                        },
                    ]}
                    accessibilityLabel={ctaLabel}
                >
                    {submitting || isGuardSubmitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <Text style={[styles.publishCtaText, { color: colors.textInverse }]}>{ctaLabel}</Text>
                            <Text style={[styles.publishCtaArrow, { color: colors.textInverse }]}>→</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <TimePickerModal
                visible={showTimePicker !== null}
                mode={showTimePicker}
                hasEndTime={hasEndTime}
                startHour={startHour}
                startMinIdx={startMinIdx}
                startAmPm={startAmPm}
                endHour={endHour}
                endMinIdx={endMinIdx}
                endAmPm={endAmPm}
                onStartHourChange={setStartHour}
                onStartMinIdxChange={setStartMinIdx}
                onStartAmPmChange={setStartAmPm}
                onEndHourChange={setEndHour}
                onEndMinIdxChange={setEndMinIdx}
                onEndAmPmChange={setEndAmPm}
                onRemoveEndTime={() => {
                    setHasEndTime(false);
                    setShowTimePicker(null);
                }}
                onClose={() => setShowTimePicker(null)}
            />

            <CalendarPicker
                visible={showDatePicker === 'single'}
                selectedDate={eventDate}
                onSelect={(d) => {
                    setEventDate(d);
                    handleClearError('eventDate');
                }}
                onClose={() => setShowDatePicker(null)}
                colors={colors}
                title="Event Date"
            />
            <CalendarPicker
                mode="range"
                visible={showDatePicker === 'range'}
                startDate={rsStartDate}
                endDate={rsEndDate}
                onConfirm={(start, end) => {
                    setRsStartDate(start);
                    setRsEndDate(end);
                    handleClearError('rsStartDate');
                    handleClearError('rsEndDate');
                    setShowDatePicker(null);
                }}
                onClose={() => setShowDatePicker(null)}
                colors={colors}
                title="Date Range"
            />

            <AttendeePickerModal
                visible={showAttendeePicker}
                onClose={handleCloseAttendeePicker}
                pickerTab={pickerTab}
                onTabChange={setPickerTab}
                userSearch={userSearch}
                onUserSearchChange={setUserSearch}
                loadingUsers={loadingUsers}
                usersError={usersError}
                filteredUsers={filteredUsers}
                selectedAttendees={selectedAttendees}
                onToggleAttendee={toggleAttendee}
                onRetryLoadUsers={loadUsers}
                externalName={externalName}
                onExternalNameChange={setExternalName}
                externalRole={externalRole}
                onExternalRoleChange={setExternalRole}
                externalAttendees={externalAttendees}
                onAddExternal={handleAddExternal}
                onRemoveExternal={handleRemoveExternal}
            />

            <MapPicker
                visible={showMapPicker}
                initialLatitude={latitude}
                initialLongitude={longitude}
                initialName={location}
                onConfirm={handleConfirmPin}
                onCancel={() => setShowMapPicker(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 60 },
    field: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    textArea: { minHeight: 96, paddingTop: 12 },
    errorText: { fontSize: 12, marginTop: 4 },
    saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
    saveBtnText: { fontWeight: '700', fontSize: 14 },
    sectionEyebrow: {
        fontSize: 10.5,
        fontFamily: TropicFonts.uiSemiBold,
        letterSpacing: 1.2,
        marginBottom: 8,
        paddingHorizontal: 2,
    },
    basicsCard: {
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 14,
    },
    basicsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 11,
        minHeight: 44,
    },
    basicsLabel: {
        fontSize: 12,
        fontFamily: TropicFonts.uiMedium,
    },
    basicsValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 1,
        maxWidth: '70%',
    },
    basicsValue: {
        fontSize: 14,
        fontFamily: TropicFonts.serif,
        fontWeight: '500',
        flexShrink: 1,
    },
    basicsArrow: {
        fontSize: 14,
        fontFamily: TropicFonts.serifItalic,
    },
    basicsInput: {
        flex: 1,
        fontSize: 14,
        fontFamily: TropicFonts.serif,
        fontWeight: '500',
        marginLeft: 12,
        padding: 0,
        textAlign: 'right',
    },
    basicsDivider: { height: StyleSheet.hairlineWidth },
    basicsSubRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 11,
        marginTop: -4,
    },
    basicsSubAction: {
        paddingBottom: 11,
        marginTop: -4,
        alignSelf: 'flex-end',
    },
    basicsSubActionText: { fontSize: 12, fontFamily: TropicFonts.uiSemiBold },
    basicsSubText: { fontSize: 11.5, fontFamily: TropicFonts.ui },

    invitesCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        gap: 12,
    },
    invitesCount: { fontSize: 14.5, fontFamily: TropicFonts.serif, fontWeight: '500' },
    invitesBreakdown: { fontSize: 11, fontFamily: TropicFonts.ui, marginTop: 2 },
    invitesManage: { fontSize: 12 },
    highlightFrame: {
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        marginVertical: 8,
        gap: 4,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    topBarSide: { fontSize: 13, fontFamily: TropicFonts.uiMedium },
    topBarTitle: { fontSize: 14, fontFamily: TropicFonts.serif, fontWeight: '500' },
    stickyCtaWrap: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 18,
        paddingVertical: 16,
        paddingBottom: 28,
    },
    publishCta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 15,
        borderRadius: 14,
        minHeight: 52,
    },
    // colors applied inline via theme token (colors.textInverse)
    publishCtaText: {
        fontSize: 16,
        fontFamily: TropicFonts.serif,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    publishCtaArrow: {
        fontSize: 16,
        fontFamily: TropicFonts.serifItalic,
        opacity: 0.85,
    },
    submitError: { borderRadius: 10, padding: 12, marginBottom: 8 },
    pinStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
        paddingHorizontal: 2,
    },
    pinStatusText: { fontSize: 12 },
    pinStatusAction: { fontSize: 12, fontWeight: '600' },
});
