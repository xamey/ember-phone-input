import { action } from '@ember/object';
import { assert } from '@ember/debug';
import { inject as service } from '@ember/service';
import { isPresent } from '@ember/utils';
import Component from '@glimmer/component';
import type Owner from '@ember/owner';
import type PhoneInputService from '../services/phone-input';
import { fr } from 'intl-tel-input/i18n';

import 'intl-tel-input/build/css/intlTelInput.css';
import '../styles/styles.css';

export interface MetaData {
  extension: string;
  selectedCountryData: intlTelInput.CountryData;
  isValidNumber: boolean;
  numberFormat: {
    E164: string;
    INTERNATIONAL: string;
    NATIONAL: string;
    RFC3966: string;
  } | null;
}

export interface PhoneInputArgs {
  number: string | null;
  update: (number: string | null, meta: MetaData) => void;
  country?: string;
  disabled?: boolean;
  required?: boolean;
  autocomplete?: string | null;
  allowDropdown?: boolean;
  autoPlaceholder?: 'aggressive' | 'off' | 'polite' | undefined;
  customPlaceholder?: string | null;
  initialCountry?: string;
  onlyCountries?: string[];
  preferredCountries?: string[];
  separateDialCode?: boolean;
  onError?: (error: unknown) => void;
}

export interface PhoneInputSignature {
  Element: HTMLInputElement;
  Args: PhoneInputArgs;
}

/**
  A phone-input component. Usage:
  ```hbs
    <PhoneInput
    allowDropdown=false
    autoPlaceholder='aggressive'
    customPlaceholder='Enter phone number'
    disabled=true
    required=required
    autocomplete=autocomplete
    initialCountry='fr'
    number='123'
    onlyCountries=europeanCountries
    preferredCountries=englishSpeakingCountries
    separateDialCode=true
    update=(action 'handleUpdate')/>
  ```

  @class PhoneInput
  @public
*/
export default class PhoneInputComponent extends Component<PhoneInputSignature> {
  @service declare phoneInput: PhoneInputService;

  isLoadingIntlTelInput = false;
  type = 'tel';
  update: (number: string | null, meta: MetaData) => void;
  private intlTelInputInstance: intlTelInput.Plugin | null = null;

  constructor(owner: Owner, args: PhoneInputArgs) {
    super(owner, args);

    /**
     * You have to implement this function to update the `number`.
     * @argument update
     * @param {string} number The international phoneNumber
     * @param {Object} metadata The phoneNumber metadata
     * @param {string} metadata.extension The extension part of the current number, so if the number was '+1 (702) 123-1234 ext. 12345' this would return '12345'.
     * @param {Object} metadata.selectedCountryData The country data for the currently selected flag.
     * @param {boolean} metadata.isValidNumber The validity of the current `phoneNumber`.
     */

    this.update = this.args.update || function (): void {};

    if (this.customPlaceholder) {
      assert(
        '`customPlaceholder` must be of type string',
        typeof this.customPlaceholder === 'string'
      );
    }

    const validAutoPlaceholder = [
      'polite',
      'aggressive',
      'off',
      undefined
    ].includes(this.autoPlaceholder);

    assert(
      "`autoPlaceholder` possible values are 'polite', 'aggressive' and 'off'",
      validAutoPlaceholder
    );
  }

  /**
   * It will force the selected country. Set the country by it's country code.
   * Useful if you want to provide the component with a country, instead of
   * using the built-in country dropdown.
   * Defaults to ''.
   * @argument country
   * @type {string}
   */
  get country(): string {
    return this.args.country || '';
  }

  /**
   * The international phone number. This is the main data supposed
   * to be persisted / handled.
   * @argument number
   * @type {string|null}
   */
  get number(): string | null {
    return this.args.number || null;
  }

  /**
   * Setting this to true will disable the input and the country dropdown.
   * Defaults to `false`
   * @argument disabled
   * @type {boolean}
   */
  get disabled(): boolean {
    return this.args.disabled || false;
  }

  /**
   * Setting this to true will make the input field required. This will enable client side form validation.
   * Defaults to `false`
   * @argument required
   * @type {boolean}
   */
  get required(): boolean {
    return this.args.required || false;
  }

  /**
   * `autocomplete` attribute on input field. Can be used to support browser autocompletion.
   * Defaults to `null`
   * @argument autocomplete
   * @type {string|null}
   */
  get autocomplete(): string | null {
    return this.args.autocomplete || null;
  }

  /**
   * Whether or not to allow the dropdown. If disabled, there is no dropdown arrow, and the selected flag is not clickable. Also we display the selected flag on the right instead because it is just a marker of state.
   * @argument allowDropdown
   * @type {boolean}
   */
  get allowDropdown(): boolean {
    return isPresent(this.args.allowDropdown) ? this.args.allowDropdown : true;
  }

  /**
   * Add or remove input placeholder with an example number for the selected
   * country. Possible values are 'polite', 'aggressive' and 'off'. Defaults to
   * 'polite'.
   * @argument autoPlaceholder
   * @type {'aggressive' | 'off' | 'polite' | undefined}
   */

  get autoPlaceholder(): 'aggressive' | 'off' | 'polite' | undefined {
    return this.args.autoPlaceholder || 'polite';
  }

  /**
   * Replace the auto placeholder with a custom placeholder.
   * If defined, must return a string. Defaults to null.
   * @argument customPlaceholder
   * @type {string|null}
   */
  get customPlaceholder(): string | null {
    return this.args.customPlaceholder || null;
  }

  /**
   * It will just be the first country in the list. Set the initial country by
   * its country code. Defaults to ''.
   * @argument initialCountry
   * @type {string}
   */
  get initialCountry(): string {
    return this.args.initialCountry || '';
  }

  /**
   * Display only the countries you specify -
   * [see example](http://jackocnr.com/lib/intl-tel-input/examples/gen/only-countries-europe.html).
   * @argument onlyCountries
   * @type {Array}
   */

  get onlyCountries(): string[] {
    return this.args.onlyCountries || Array<string>();
  }

  /**
   * Specify the countries to appear at the top of the list.
   * @argument preferredCountries
   * @type {Array}
   */
  get preferredCountries(): string[] {
    return this.args.preferredCountries || ['us', 'gb'];
  }

  /**
   * Display the country dial code next to the selected flag so it's not part of the typed number
   * @argument separateDialCode
   * @type {boolean}
   */
  get separateDialCode(): boolean {
    return this.args.separateDialCode || false;
  }

  @action
  onInput(event?: Event): boolean {
    const internationalPhoneNumber =
      this.intlTelInputInstance?.getNumber() ??
      (event?.target as HTMLInputElement).value;

    const meta = this.metaData(this.intlTelInputInstance);
    this.update(internationalPhoneNumber, meta);

    return true;
  }

  @action
  onDidUpdate(): void {
    this.formatNumber();
  }

  @action
  onDidInsert(element: HTMLInputElement): void {
    this.loadAndSetup(element);
  }

  @action
  onDestroy(element: HTMLInputElement): void {
    this.intlTelInputInstance?.destroy();
    element.removeEventListener('countrychange', this.onCountryChange);
  }

  private async loadAndSetup(element: HTMLInputElement): Promise<void> {
    try {
      this.isLoadingIntlTelInput = true;

      await this.phoneInput.load();

      // Even if the above promise resolves, it might be at the end of the
      // component lifecycle
      if (this.isDestroying || this.isDestroyed) {
        return;
      }

      this.setupLibrary(element);

      this.formatNumber();

      element.addEventListener(
        'countrychange',
        this.onCountryChange.bind(this)
      );
    } catch (error) {
      this.args.onError?.(error);
    } finally {
      if (!this.isDestroying && !this.isDestroyed) {
        this.isLoadingIntlTelInput = false;
      }
    }
  }

  private formatNumber(): void {
    if (!this.intlTelInputInstance) {
      return;
    }

    if (this.country) {
      this.intlTelInputInstance.setCountry(this.country);
    }

    if (this.number) {
      this.intlTelInputInstance.setNumber(this.number);
    }
  }

  private setupLibrary(element: HTMLInputElement): void {
    if (!this.phoneInput.intlTelInput) {
      return;
    }

    const {
      allowDropdown,
      autoPlaceholder,
      customPlaceholder,
      initialCountry,
      onlyCountries,
      preferredCountries,
      separateDialCode
    } = this;

    const options: intlTelInput.Options = {
      autoInsertDialCode: false,
      nationalMode: true,
      i18n: fr,
      allowDropdown,
      autoPlaceholder,
      initialCountry,
      onlyCountries,
      preferredCountries,
      separateDialCode
    };

    if (customPlaceholder) {
      options.customPlaceholder = (): string => customPlaceholder;
    }

    const intlTelInputInstance = this.phoneInput.intlTelInput(element, options);

    if (this.number) {
      intlTelInputInstance.setNumber(this.number);
    }

    this.intlTelInputInstance = intlTelInputInstance;

    if (this.initialCountry) {
      this.intlTelInputInstance.setCountry(this.initialCountry);
    }

    this.update(this.number, this.metaData(intlTelInputInstance));
  }

  private metaData(intlTelInputPlugin: intlTelInput.Plugin | null): MetaData {
    if (!intlTelInputPlugin) {
      // Libraries may rely on always receiving an object
      return {} as MetaData;
    }

    const extension = intlTelInputPlugin.getExtension();
    const selectedCountryData = intlTelInputPlugin.getSelectedCountryData();
    const isValidNumber = intlTelInputPlugin.isValidNumber();
    const E164 = intlTelInputPlugin.getNumber(
      intlTelInputUtils.numberFormat.E164
    );
    const INTERNATIONAL = intlTelInputPlugin.getNumber(
      intlTelInputUtils.numberFormat.INTERNATIONAL
    );
    const NATIONAL = intlTelInputPlugin.getNumber(
      intlTelInputUtils.numberFormat.NATIONAL
    );
    const RFC3966 = intlTelInputPlugin.getNumber(
      intlTelInputUtils.numberFormat.RFC3966
    );

    return {
      extension,
      selectedCountryData,
      isValidNumber,
      numberFormat: isValidNumber
        ? {
            E164,
            INTERNATIONAL,
            NATIONAL,
            RFC3966
          }
        : null
    };
  }

  private onCountryChange(): void {
    const selectedCountry = this.intlTelInputInstance?.getSelectedCountryData();

    if (selectedCountry?.iso2) {
      this.intlTelInputInstance?.setCountry(selectedCountry.iso2);
    }

    this.onInput();
  }
}
