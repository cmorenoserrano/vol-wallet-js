// Copyright (c) 2020 Cryptogogue, Inc. All Rights Reserved.

import { AccountInfoService }               from './services/AccountInfoService';
import { AccountStateService }              from './services/AccountStateService';
import { TransactionModal }                 from './TransactionModal';
import { assert, excel, hooks, RevocableContext, SingleColumnContainerView, util } from 'fgc';
import { action, computed, extendObservable, observable, observe } from 'mobx';
import { observer }                         from 'mobx-react';
import React, { useState, useRef }          from 'react';
import { Redirect }                         from 'react-router';
import { useParams }                        from 'react-router-dom';
import * as UI                              from 'semantic-ui-react';

import { AccountNavigationBar, ACCOUNT_TABS } from './AccountNavigationBar';

//================================================================//
// AccountDebugScreen
//================================================================//
export const AccountDebugScreen = observer (( props ) => {

    const networkID = util.getMatch ( props, 'networkID' );
    const accountID = util.getMatch ( props, 'accountID' );

    const appState      = hooks.useFinalizable (() => new AccountStateService ( networkID, accountID ));
    const accountURL    = `${ appState.network.nodeURL }/accounts/${ appState.accountID }`;
    const hasInfo       = appState.hasAccountInfo;

    return (
        <SingleColumnContainerView>

            <AccountNavigationBar
                appState    = { appState }
                tab         = { ACCOUNT_TABS.ACCOUNT }
            />

            <If condition = { appState.hasAccount }>

                <UI.Segment>
                    <div style = {{ textAlign: 'center' }}>
                        <UI.Header as = "h2" icon>
                            <Choose>
                                <When condition = { hasInfo }>
                                    <UI.Icon name = 'trophy' circular />
                                </When>
                                <Otherwise>
                                    <UI.Icon name = 'circle notched' loading circular/>
                                </Otherwise>
                            </Choose>
                            <a href = { accountURL } target = '_blank'>{ appState.accountID }</a>
                        </UI.Header>

                        <div style = {{ visibility: hasInfo ? 'visible' : 'hidden' }}>
                            <UI.Header as = 'h3'>
                                { `Balance: ${ appState.balance }` }
                            </UI.Header>

                            <UI.Header.Subheader>
                                { `Transaction Nonce: ${ appState.nonce }` }
                            </UI.Header.Subheader>

                            <UI.Header.Subheader>
                                { `Inventory Nonce: ${ appState.inventoryNonce }` }
                            </UI.Header.Subheader>

                            <UI.Header.Subheader>
                                { `Inventory Nonce (Node): ${ hasInfo ? appState.accountInfo.inventoryNonce : appState.inventoryNonce }` }
                            </UI.Header.Subheader>
                        </div>
                    </div>
                </UI.Segment>

                <UI.Button
                    fluid
                    color       = 'teal'
                    onClick     = {() => { appState.setAccountInventoryNonce ( 0 )}}
                >
                    Reset Inventory Nonce
                </UI.Button>
            </If>

        </SingleColumnContainerView>
    );
});
