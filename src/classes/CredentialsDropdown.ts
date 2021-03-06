import * as $ from 'jquery-slim';
import * as styles from "../scss/content.scss";
import * as IMessage from "../IMessage";
import Client from "./BackgroundClient";
import FieldSet from "./FieldSet";
import PageControl from "./PageControl";

const copyIcon = require('../assets/copy_to_clipboard.svg')


/** A dropdown that displays the available credentials and allows to choose between them. */
export default class CredentialsDropdown {
    /** The actual dropdown. */
    private _dropdown?: JQuery;
    /** The credential items shown in the dropdown .*/
    private _credentialItems?: JQuery[];
    /** The field set that the drawer is opened for. */
    private _fieldSet?: FieldSet;
    /** Window resize handler. */
    private readonly _RESIZE_HANDLER = (_event: JQuery.ResizeEvent) => this._reposition();

    /**
     * @param _pageControl The current page controller.
     */
    constructor(private readonly _pageControl: PageControl) {
    }

    /**
     * @return Whether or not the dropdown is currently opened.
     */
    public get isOpen(): boolean {
        return this._dropdown !== undefined;
    }

    /**
     * @return Whether or not the event caused an element in the dropdown to gain focus.
     */
    public hasGainedFocus(event: JQuery.FocusOutEvent): boolean {
        return event.relatedTarget instanceof HTMLElement && this._dropdown?.has(event.relatedTarget).length != 0;
    }

    /**
     * Open the credentials dropdown.
     * @param fieldSet The field set to open the credential drawer for.
     */
    public open(fieldSet: FieldSet) {
        if (this.isOpen) {
            if (fieldSet === this._fieldSet) {
                return; // Dropdown is already open
            }
            this.close();
        }
        const theme = this._pageControl.settings.theme;
        // Create the dropdown
        this._dropdown = $('<div>').addClass(styles.dropdown).css({
            left: `0px`,
            top: `0px`,
            'margin-bottom': `${Math.max(theme.dropdownShadowWidth, 2)}px`,
            'margin-right': `${Math.max(theme.dropdownShadowWidth, 2)}px`,
            'margin-left': `${Math.max(theme.dropdownShadowWidth, 2)}px`,
            'border-width': `${theme.dropdownBorderWidth}px`,
            'box-shadow': `0 ${theme.dropdownShadowWidth}px ${theme.dropdownShadowWidth}px 0 rgba(0,0,0,0.2)`,
        });
        this._fieldSet = fieldSet;
        let style = this._dropdown.get(0).style;
        style.setProperty('--dropdown-select-background-start', theme.dropdownSelectedItemColorStart);
        style.setProperty('--dropdown-select-background-end', theme.dropdownSelectedItemColorEnd);
        style.setProperty('--scrollbar-color', theme.dropdownScrollbarColor);

        // Generate the content
        const content = $('<div>').addClass(styles.content);
        this._generateDropdownContent(content, fieldSet.getCredentials());
        this._dropdown.append(content);

        if (theme.enableDropdownFooter) {
            // Create the footer and add it to the dropdown
            // noinspection HtmlRequiredAltAttribute,RequiredAttributes
            const footerItems: (JQuery | string)[] = [
                $('<img>').addClass(styles.logo).attr('src', chrome.extension.getURL('images/icon48.png'))
                    .attr('alt', ''),
                'ChromeKeePass',
                $('<img>').attr('src', chrome.extension.getURL('images/gear.png')).attr('tabindex', '0')
                    .attr('alt', 'Open Settings').attr('title', 'Open settings').css({cursor: 'pointer'})
                    .on('click', this._openOptionsWindow.bind(this)).on('focusout', this._onItemFocusLost.bind(this)),
                // $('<img>').attr('src', chrome.extension.getURL('images/key.png')).attr('title', 'Generate password').css({cursor: 'pointer'}),
            ];
            const footer = $('<div>').addClass(styles.footer).append(...footerItems);
            this._dropdown.append(footer);
        }
        // Show the dropdown
        $(document.body).append(this._dropdown);
        this._reposition();
        $(window).on('resize', this._RESIZE_HANDLER);
    }

    /** Close the dropdown. */
    public close() {
        if (this._dropdown) {
            $(window).off('resize', this._RESIZE_HANDLER);
            this._dropdown.remove();
            this._credentialItems = undefined;
            this._fieldSet?.selectCredential(undefined);
            this._fieldSet = undefined;
            this._dropdown = undefined;
        }
    }

    /**
     * Set the list of credentials that are shown in the dropdown.
     * @param credentials The list of credentials.
     */
    public setCredentials(credentials: IMessage.Credential[]) {
        if (this._dropdown === undefined) {
            return;
        }
        const target = this._dropdown.find(`.${styles.content}`);
        this._generateDropdownContent(target, credentials);
    }

    /**
     * Select the next credential in the list.
     * @param reverse Whether to select the previous or next.
     */
    public selectNextCredential(reverse?: boolean) {
        if (!(this._credentialItems && this._credentialItems.length)) { // There is something available?
            return;
        }
        let selectedIndex = this._credentialItems.findIndex((item) => item.hasClass(styles.selected));
        if (selectedIndex == -1) {
            selectedIndex = 0;
        } else {
            this._credentialItems[selectedIndex].removeClass(styles.selected);
            if (!reverse) {
                selectedIndex = ++selectedIndex % this._credentialItems.length;
            } else if (--selectedIndex < 0) { // Jump back to the last item if we get past the first item
                selectedIndex = this._credentialItems.length - 1;
            }
        }
        this._credentialItems[selectedIndex].addClass(styles.selected);
        this._credentialItems[selectedIndex].get(0).scrollIntoView({
            behavior: "auto",
            block: "nearest"
        });
        this._fieldSet?.selectCredential(this._credentialItems[selectedIndex].data('credential'));
    }

    /** Recalculate the position of the dropdown. */
    private _reposition() {
        if (this._dropdown === undefined || this._fieldSet === undefined) {
            return;
        }
        const target = this._fieldSet.controlField;
        if (target === undefined) {
            return;
        }
        const documentBody = $(document.body);
        const bodyIsOffsetParent = this._dropdown.offsetParent().get(0) === document.body;
        const bodyWidth = Math.max(documentBody.outerWidth(bodyIsOffsetParent) || 0, window.innerWidth);
        const bodyHeight = Math.max(documentBody.outerHeight(bodyIsOffsetParent) || 0, window.innerHeight);
        const targetOffset = target.offset();
        const theme = this._pageControl.settings.theme;
        const minWidth = 225;
        const targetWidth = target.outerWidth() || minWidth;
        let left = (targetOffset?.left || 0) - Math.max(theme.dropdownShadowWidth, 2);
        if (targetWidth < minWidth) {
            left -= (minWidth - targetWidth) / 2.0;
        }
        if (left < scrollX) {
            left = scrollX - Math.max(theme.dropdownShadowWidth, 2);
        } else if (left + scrollX + minWidth > bodyWidth) {
            left = bodyWidth - minWidth - Math.max(theme.dropdownShadowWidth, 2);
        }
        let top = (targetOffset?.top || 0) + (target.outerHeight() || 10);
        const dropdownHeight = this._dropdown.outerHeight(true) || 0;
        if (top - scrollY + dropdownHeight > bodyHeight) {
            const offset = dropdownHeight + (target.outerHeight() || 0);
            if (bodyHeight - top >= top || top - offset < scrollY) {
                top = scrollY + bodyHeight - dropdownHeight;
            } else {
                top -= offset;
            }
        }
        if (bodyIsOffsetParent) {
            top -= parseFloat(documentBody.css('marginTop')) + parseFloat(documentBody.css('borderTopWidth'));
            left -= parseFloat(documentBody.css('marginLeft')) + parseFloat(documentBody.css('borderLeftWidth'));
        }
        this._dropdown.css({
            left: `${left}px`,
            top: `${top}px`,
            width: `${targetWidth}px`,
        });
    }

    /**
     * Generate the html for the dropdown content.
     *
     * @param container The container for the credential items.
     * @param credentials The credentials to show in the dropdown.
     */
    private _generateDropdownContent(container: JQuery, credentials: IMessage.Credential[]) {
        if (credentials.length) {
            const items: JQuery[] = [];
            credentials.forEach((credential) => {
                items.push(
                    $('<div>').data('credential', credential).addClass(styles.item).attr('tabindex', '0').css(
                        {'padding': `${this._pageControl.settings.theme.dropdownItemPadding}px`}).append(
                        $('<div>').addClass(styles.primaryText).text(credential.title)
                    ).append(
                        $('<div>').text(credential.username)
                    ).on('click', this._onClickCredential.bind(this)).on('focusout', this._onItemFocusLost.bind(this))
                );
            });
            this._credentialItems = items;
            container.empty().append(items);

            if(items.length === 1) // Is there only one item?
                this.selectNextCredential(); // Select it

        } else { // No credentials available
            this._credentialItems = undefined;
            this._fieldSet?.selectCredential(undefined);
            container.empty().append($('<div>').addClass(styles.noResults).text('No credentials found'));
            if (self != top) {
                const iframeInfo = $('<div>').addClass(styles.iframeInfo);
                iframeInfo.append($('<div>').text(
                    'This input is part of a website that is embedded into the current website. ' +
                    'Your passwords should be registered with the following URL:'));

                const urlInput = $('<input>').attr('readonly', 'readonly').attr('type', 'url')
                    .val(self.location.origin);
                const copyToClipboardIcon = $('<div>').addClass(styles.copyIcon).html(copyIcon)
                    .attr('title', 'Copy to clipboard').attr('tabindex', '0')
                    .on('click', (event)=>{
                        event.preventDefault();
                        this._copyIframeUrl(copyToClipboardIcon, urlInput);
                    });
                iframeInfo.append($('<div>').attr('class', styles.inputWrapper)
                    .append(urlInput).append(copyToClipboardIcon)
                );
                container.append(iframeInfo);
            }
        }
    }

    /** Open the extension's option window. */
    private _openOptionsWindow() {
        Client.openOptions();
        this.close();
    }

    /**
     * Copy the url of the current iframe into the clipboard.
     * @param icon The icon that was clicked.
     * @param urlInput The input element that contains the url of the current iframe.
     */
    private _copyIframeUrl(icon: JQuery, urlInput: JQuery) {
        urlInput.trigger('select');
        const success = document.execCommand('copy');
        if (success) {
            icon.addClass(styles.success);
            setTimeout(() => icon.removeClass(styles.success), 3000);
        }
        this._fieldSet?.controlField?.trigger('focus');
    }

    /** Handle a click on a credential field. */
    private _onClickCredential(event: JQuery.ClickEvent) {
        this._fieldSet?.selectCredential($(event.target).closest(`.${styles.item}`).data('credential'));
        this._fieldSet?.enterSelection();
    }

    /**
     * Handle a focus lost event on one of the credentials items.
     * @param event The focus out event.
     */
    private _onItemFocusLost(event: JQuery.FocusOutEvent) {
        if (!this.hasGainedFocus(event) && (event.relatedTarget === undefined
            || event.relatedTarget !== this._fieldSet?.controlField?.get(0))) {
            this.close();
        }
    }
}
