import CalendarPicker from '@/components/CalendarPicker';
import ScreenHeader from '@/components/ScreenHeader';
import AttendeeList from '@/components/events/AttendeeList';
import AttendeePickerModal from '@/components/events/AttendeePickerModal';
import EventDateSection from '@/components/events/EventDateSection';
import EventTypeSelector from '@/components/events/EventTypeSelector';
import RoadshowSettingsForm from '@/components/events/RoadshowSettingsForm';
import TimePickerModal from '@/components/events/TimePickerModal';
import TimeRowCard from '@/components/events/TimeRowCard';
import { ERROR_BG, ERROR_TEXT } from '@/constants/ui';
import { useTheme } from '@/contexts/ThemeContext';
import { useEventForm } from '@/hooks/useEventForm';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import { dateDiffDays, isValidDate } from '@/lib/dateTime';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateEventScreen() {
    const { colors } = useTheme();
    const { isSubmitting: isGuardSubmitting, guard } = useSubmitGuard();
    const form = useEventForm();

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

    if (loadingEvent) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader title="Edit Event" showBack onBack={() => router.back()} />
                <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader
                title={isEditing ? 'Edit Event' : 'Create Event'}
                showBack
                onBack={() => router.back()}
                rightAction={
                    <TouchableOpacity
                        testID="event-create-save"
                        onPress={() => guard(handleSubmit)}
                        disabled={submitting || isGuardSubmitting}
                        style={[
                            styles.saveBtn,
                            {
                                backgroundColor: colors.accent,
                                opacity: submitting || isGuardSubmitting ? 0.5 : 1,
                            },
                        ]}
                    >
                        {submitting || isGuardSubmitting ? (
                            <ActivityIndicator size="small" color={colors.textInverse} />
                        ) : (
                            <Text style={[styles.saveBtnText, { color: colors.textInverse }]}>
                                {isEditing
                                    ? 'Save'
                                    : eventType === 'roadshow' &&
                                        rsStartDate &&
                                        rsEndDate &&
                                        isValidDate(rsStartDate) &&
                                        isValidDate(rsEndDate) &&
                                        rsEndDate >= rsStartDate
                                      ? `Create ${dateDiffDays(rsStartDate, rsEndDate) + 1}`
                                      : 'Create'}
                            </Text>
                        )}
                    </TouchableOpacity>
                }
            />

            <KeyboardAwareScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Title */}
                <View style={styles.field}>
                    <Text style={labelStyle}>Title *</Text>
                    <TextInput
                        testID="event-create-title"
                        style={[
                            inputStyle,
                            isEditingRoadshow && { opacity: 0.5 },
                            errors.title && { borderColor: colors.danger },
                        ]}
                        placeholder="Event title"
                        placeholderTextColor={colors.textTertiary}
                        value={title}
                        onChangeText={(t) => {
                            setTitle(t);
                            handleClearError('title');
                        }}
                        editable={!isEditingRoadshow}
                    />
                    {errors.title ? (
                        <Text style={[styles.errorText, { color: colors.danger }]}>{errors.title}</Text>
                    ) : null}
                </View>

                <EventTypeSelector eventType={eventType} onSelect={setEventType} disabled={isEditingRoadshow} />

                <EventDateSection
                    isRoadshow={eventType === 'roadshow'}
                    isEditing={isEditing}
                    isEditingRoadshow={isEditingRoadshow}
                    eventDate={eventDate}
                    rsStartDate={rsStartDate}
                    rsEndDate={rsEndDate}
                    errors={errors}
                    onOpenDatePicker={setShowDatePicker}
                />

                {eventType === 'roadshow' && (
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
                )}

                {errors._submit ? (
                    <View style={[styles.submitError, { backgroundColor: ERROR_BG }]}>
                        <Text style={{ color: ERROR_TEXT, fontSize: 13 }}>{errors._submit}</Text>
                    </View>
                ) : null}

                <TimeRowCard
                    hasEndTime={hasEndTime}
                    formatStart={formatStart}
                    formatEnd={formatEnd}
                    onStartPress={() => setShowTimePicker('start')}
                    onEndPress={() => {
                        if (!hasEndTime) setHasEndTime(true);
                        setShowTimePicker('end');
                    }}
                    endTimeError={errors.endTime}
                />

                {/* Location */}
                <View style={styles.field}>
                    <Text style={labelStyle}>Location</Text>
                    <TextInput
                        style={inputStyle}
                        placeholder="e.g. Zoom, Marina Bay Sands"
                        placeholderTextColor={colors.textTertiary}
                        value={location}
                        onChangeText={setLocation}
                    />
                </View>

                {/* Description */}
                <View style={styles.field}>
                    <Text style={labelStyle}>Description</Text>
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

                <AttendeeList
                    selectedAttendees={selectedAttendees}
                    externalAttendees={externalAttendees}
                    onOpenPicker={() => setShowAttendeePicker(true)}
                    onUpdateRole={updateAttendeeRole}
                    onRemoveAttendee={handleRemoveAttendee}
                    onUpdateExternalRole={handleUpdateExternalRole}
                    onRemoveExternal={handleRemoveExternal}
                />
            </KeyboardAwareScrollView>

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
    submitError: { borderRadius: 10, padding: 12, marginBottom: 8 },
});
