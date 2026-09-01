import {
  FormStore,
  useForm,
  type ArrayPath,
  type DeepReadonly,
  type FormStateSelector,
  type Path,
  type UseFieldReturn,
  type UseFormOptions,
  type ValueAtPath,
  type Validator,
} from '@lpm.dev/neo.react-forms'
import { required, url, type UrlValidatorOptions } from '@lpm.dev/neo.react-forms/validators'
import { minLength } from '@lpm.dev/neo.react-forms/validators/string'
import { min } from '@lpm.dev/neo.react-forms/validators/number'
import { compose } from '@lpm.dev/neo.react-forms/validators/compose'
import { zodAdapter } from '@lpm.dev/neo.react-forms/adapters'
import {
  createFormSnapshot,
  exposeFormToWindow,
  type DevToolsPrivacyOptions,
  type ExposeFormOptions,
} from '@lpm.dev/neo.react-forms/devtools'

interface ConsumerValues {
  profile?: {
    name: string
    birthday: Date
  }
  users: Array<{ name: string; active: boolean }>
  readonlyTags: readonly string[]
  tags: string[]
  age: number | undefined
  score: number
  pattern: RegExp
  failure: Error
}

type ConsumerPath = Path<ConsumerValues>
const validOptionalPath: ConsumerPath = 'profile.name'
const validArrayPath: ConsumerPath = 'users.0.active'
const validReadonlyArrayPath: ConsumerPath = 'readonlyTags.0'
void validOptionalPath
void validArrayPath
void validReadonlyArrayPath

// Built-in leaf values must not expose their prototype methods as form paths.
// @ts-expect-error Date methods are not field paths.
const invalidDatePath: ConsumerPath = 'profile.birthday.getTime'
void invalidDatePath

type ConsumerArrayPath = ArrayPath<ConsumerValues>
const usersPath: ConsumerArrayPath = 'users'
const tagsPath: ConsumerArrayPath = 'readonlyTags'
void usersPath
void tagsPath

// @ts-expect-error Scalar fields cannot be used with FieldArray.
const invalidArrayPath: ConsumerArrayPath = 'age'
void invalidArrayPath

type NestedName = ValueAtPath<ConsumerValues, 'users.0.name'>
const nestedName: NestedName = 'Ada'
void nestedName

const options: UseFormOptions<ConsumerValues> = {
  initialValues: {
    users: [{ name: 'Ada', active: true }],
    readonlyTags: ['math'],
    tags: ['analysis'],
    age: undefined,
    score: 0,
    pattern: /safe/g,
    failure: new Error('safe'),
  },
  validate: {
    profile: {
      name: (value, values) => {
        const firstUserName: string | undefined = values?.users[0]?.name
        void firstUserName
        return value ? undefined : 'Required'
      },
      birthday: (_value, values) => values?.age === undefined ? undefined : 'Unexpected age',
    },
    users: {
      name: (value, values) => values?.readonlyTags.includes(value) ? undefined : 'Unknown',
      active: (_value, values) => values?.age === undefined ? undefined : 'Unexpected age',
    },
    age: (value) => value === undefined ? undefined : min(0)(value),
  },
  validateForm: (values) => {
    // @ts-expect-error Form validation receives a read-only snapshot.
    values.score = 1
    if (values.profile) {
      // @ts-expect-error Date mutation methods are not exposed.
      values.profile.birthday.setUTCFullYear(2030)
    }
    // @ts-expect-error RegExp state is read-only.
    values.pattern.lastIndex = 2
    // @ts-expect-error Error properties are read-only.
    values.failure.message = 'changed'
    return undefined
  },
  computed: {
    score: (values) => {
      // @ts-expect-error Computed functions receive read-only values.
      values.age = 42
      return values.score
    },
  },
}

const unsupportedPromiseOptions: UseFormOptions<{ task: Promise<string> }> = {
  // @ts-expect-error Promise values are not supported form state.
  initialValues: { task: Promise.resolve('later') },
}
const unsupportedFunctionOptions: UseFormOptions<{ callback: () => void }> = {
  // @ts-expect-error Function values are not supported form state.
  initialValues: { callback: () => undefined },
}
const unsupportedAggregateErrorOptions: UseFormOptions<{
  failure: AggregateError
}> = {
  // @ts-expect-error AggregateError values are not supported form state.
  initialValues: { failure: new AggregateError([], 'combined') },
}
void unsupportedPromiseOptions
void unsupportedFunctionOptions
void unsupportedAggregateErrorOptions

declare const binarySnapshot: DeepReadonly<{
  buffer: ArrayBuffer
  bytes: Uint8Array
  view: DataView
}>
// @ts-expect-error Read-only ArrayBuffer snapshots cannot be transferred.
binarySnapshot.buffer.transfer()
// @ts-expect-error Read-only typed-array snapshots cannot use mutating methods.
binarySnapshot.bytes.set([1])
// @ts-expect-error Read-only typed-array snapshots cannot assign elements.
binarySnapshot.bytes[0] = 1
// @ts-expect-error Read-only typed-array snapshots cannot be filled in place.
binarySnapshot.bytes.fill(1)
// @ts-expect-error Read-only DataView snapshots cannot write bytes.
binarySnapshot.view.setUint8(0, 1)

const contextAwareValidator: Validator<string, ConsumerValues> = (
  value,
  values,
  context
) => {
  const fieldName: string | undefined = context?.name
  const immutableValues: DeepReadonly<ConsumerValues> | undefined = context?.values
  const firstUserName: string | undefined = values?.users[0]?.name
  void fieldName
  void immutableValues
  void firstUserName
  if (context) {
    // @ts-expect-error Validator context values are read-only.
    context.values.age = 42
  }
  if (values) {
    // @ts-expect-error The legacy validator values argument is also read-only.
    values.age = 42
  }
  return value ? undefined : 'Required'
}
void contextAwareValidator

const selectFirstUser: FormStateSelector<ConsumerValues, string | undefined> =
  (state) => state.values.users[0]?.name
void selectFirstUser

// These imports guard every documented package subpath.
void required
void minLength
void compose
void zodAdapter
void createFormSnapshot

const urlOptions: UrlValidatorOptions = { protocols: ['https'] }
void url('Invalid URL', urlOptions)
const privacyOptions: DevToolsPrivacyOptions = {
  sensitiveFields: ['recoveryPhrase'],
}
const exposureOptions: ExposeFormOptions = { enabled: true }
void privacyOptions
void exposureOptions

declare const dateWithUnsupportedMetadata: Date & { task: Promise<string> }
declare const mapWithUnsupportedMetadata: Map<string, string> & {
  task: Promise<string>
}
// @ts-expect-error Supported built-ins cannot hide unsupported extension values.
new FormStore({ when: dateWithUnsupportedMetadata })
// @ts-expect-error Map extension properties follow the same value boundary.
new FormStore({ metadata: mapWithUnsupportedMetadata })

declare const labeledDate: Date & { label: string }
declare const labeledMap: Map<string, string> & { label: string }
const labeledDateStore = new FormStore({ when: labeledDate })
const labeledMapStore = new FormStore({ metadata: labeledMap })
const dateLabel: string = labeledDateStore.getValues().when.label
const mapLabel: string = labeledMapStore.getValues().metadata.label
// @ts-expect-error Supported built-in metadata is exposed read-only.
labeledDateStore.getValues().when.label = 'changed'
void dateLabel
void mapLabel

interface CircularValues {
  name: string
  self?: CircularValues
}
declare const circularValues: CircularValues
const circularForm = useForm({ initialValues: { circular: circularValues } })
circularForm.setFieldValue('circular.name', 'updated')
circularForm.setFieldValue('circular.self.name', 'updated')

export function PublicApiConsumer() {
  const form = useForm(options)
  // @ts-expect-error Public form values are read-only snapshots.
  form.values.score = 2
  const profileState = form.getFieldState('profile')
  // @ts-expect-error Public field-state wrappers are read-only.
  profileState.touched = true
  if (profileState.value) {
    // @ts-expect-error Public field values are read-only snapshots.
    profileState.value.name = 'Changed'
  }
  const ageField: UseFieldReturn<number | undefined> = form.useField('age')
  // @ts-expect-error Bound field state is read-only.
  ageField.error = 'poisoned'
  const firstUser = form.useFormState(selectFirstUser)
  const selectedValidity = form.useFormState(
    (state) => ({ valid: state.isValid }),
    (previous, next) => previous.valid === next.valid
  )
  void firstUser
  void selectedValidity

  ageField.setValue(21)
  // @ts-expect-error Age fields do not accept strings.
  ageField.setValue('21')
  // @ts-expect-error Unknown fields cannot be subscribed.
  form.useField('missing')

  form.batch(() => {
    form.setFieldValue('users.0.name', 'Katherine')
    form.setFieldTouched('users.0.name', true)
  })

  const snapshot = createFormSnapshot(form, options.initialValues, privacyOptions)
  const cleanupExposure = exposeFormToWindow('consumer', snapshot, exposureOptions)
  cleanupExposure()

  form.setFieldValue('users.0.name', 'Grace')
  // @ts-expect-error Array item names are strings.
  form.setFieldValue('users.0.name', 42)

  const store = new FormStore(options.initialValues)
  // @ts-expect-error Store value views are read-only snapshots.
  store.getValues().score = 3
  const unsubscribe = store.subscribe('users.0.name', (state) => {
    const value: string = state.value
    // @ts-expect-error Subscription snapshots are read-only.
    state.touched = true
    void value
  })
  unsubscribe()

  return (
    <>
      <form.Field name="age" inputType="number">
        {({ props }) => <input type="number" {...props} />}
      </form.Field>
      <form.Field name="users.0.active" inputType="checkbox">
        {({ props }) => <input type="checkbox" {...props} />}
      </form.Field>
      {/* @ts-expect-error Number parsing cannot write into a string field. */}
      <form.Field name="users.0.name" inputType="number">
        {() => null}
      </form.Field>
      {/* @ts-expect-error Clearing a number input can produce undefined. */}
      <form.Field name="score" inputType="number">
        {() => null}
      </form.Field>
      {/* @ts-expect-error Fields are always controlled; this prop does not exist. */}
      <form.Field name="age" controlled={false}>
        {() => null}
      </form.Field>
      <form.FieldArray name="users">
        {({ fields, helpers }) => {
          // @ts-expect-error FieldArray item values are read-only snapshots.
          fields[0]!.value.name = 'Changed'
          // @ts-expect-error FieldArray item wrappers are read-only.
          fields[0]!.index = 99
          // @ts-expect-error FieldArray fields collections are read-only.
          fields.push(fields[0]!)
          return <ul>
            {fields.map((field) => <li key={field.key}>{field.value.name}</li>)}
            <button
              type="button"
              onClick={() => helpers.append({ name: 'Grace', active: true })}
            >
              Add
            </button>
          </ul>
        }}
      </form.FieldArray>
      <form.Field name="tags" inputType="select-multiple">
        {({ props }) => {
          if (props.value) {
            // @ts-expect-error Select-multiple values are read-only snapshots.
            props.value.push('poisoned')
          }
          return <select multiple {...props} />
        }}
      </form.Field>
      <form.FieldArray name="readonlyTags">
        {({ fields }) => <span>{fields[0]?.value.toUpperCase()}</span>}
      </form.FieldArray>
      {/* @ts-expect-error FieldArray only accepts array-valued paths. */}
      <form.FieldArray name="age">{() => null}</form.FieldArray>
    </>
  )
}
