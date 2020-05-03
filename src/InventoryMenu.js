// Copyright (c) 2020 Cryptogogue, Inc. All Rights Reserved.

import './InventoryScreen.css';

import { AccountInfoService }                               from './AccountInfoService';
import { AccountNavigationBar, ACCOUNT_TABS }               from './AccountNavigationBar';
import { AppStateService }                                  from './AppStateService';
import { CraftingFormController }                           from './CraftingFormController';
import { InventoryFilterDropdown }                          from './InventoryFilterDropdown';
import { InventoryTagController }                           from './InventoryTagController';
import { InventoryTagDropdown }                             from './InventoryTagDropdown';
import { TransactionFormController_SendAssets }             from './TransactionFormController_SendAssets';
import { TransactionModal }                                 from './TransactionModal';
import { AssetModal, AssetTagsModal, inventoryMenuItems, InventoryService, InventoryViewController, InventoryPrintView, InventoryView } from 'cardmotron';
import { assert, excel, hooks, RevocableContext, SingleColumnContainerView, util } from 'fgc';
import _                                                    from 'lodash';
import { action, computed, extendObservable, observable }   from "mobx";
import { observer }                                         from 'mobx-react';
import React, { useState }                                  from 'react';
import { Redirect }                                         from 'react-router';
import { Link }                                             from 'react-router-dom';
import { Dropdown, Grid, Icon, List, Menu, Loader }         from 'semantic-ui-react';

//================================================================//
// InventoryMenu
//================================================================//
export const InventoryMenu = observer (( props ) => {

    const { appState, controller, craftingFormController, tags } = props;

    const [ transactionController, setTransactionController ] = useState ( false );

    const onClickSendAssets = () => {
        setTransactionController (
            new TransactionFormController_SendAssets (
                appState,
                controller.selection
            )
        );
    }

    const onClickCraftingMethod = ( methodName ) => {
        console.log ( 'SHOWING TRANSACTION FORM', methodName );
        craftingFormController.addInvocation ( methodName );
        setTransactionController ( craftingFormController );
    }

    const onCloseTransactionModal = () => {
        setTransactionController ( false );
        controller.clearSelection ();
        craftingFormController.reset ();
    }

    let methodListItems = [];
    if ( craftingFormController.binding ) {
        const methodBindings = craftingFormController.binding.getCraftingMethodBindings ();
        for ( let methodName in methodBindings ) {
            const binding = methodBindings [ methodName ];
            const disabled = !binding.valid;
            
            methodListItems.push (<Dropdown.Item
                key         = { methodName }
                text        = { methodName }
                disabled    = { disabled }
                onClick     = {() => { onClickCraftingMethod ( methodName )}}
            />);
        }
    }

    return (
        <React.Fragment>

            <Menu attached = 'top'>
                <inventoryMenuItems.SortModeFragment        controller = { controller }/>
                <inventoryMenuItems.LayoutOptionsDropdown   controller = { controller }/>
                
                <Choose>
                    <When condition = { controller.isPrintLayout }>
                        <Menu.Item name = "Print" onClick = {() => { window.print ()}}>
                            <Icon name = 'print'/>
                        </Menu.Item>
                    </When>

                    <Otherwise>
                        <inventoryMenuItems.ZoomOptionsDropdown     controller = { controller }/>
                    </Otherwise>
                </Choose>
            </Menu>

            <Menu borderless attached = 'bottom'>
                <InventoryTagDropdown                       controller = { controller } tags = { tags }/>
                <InventoryFilterDropdown                    tags = { tags }/>

                <Menu.Menu position = "right">
                    <Menu.Item
                        icon        = 'envelope'
                        disabled    = { !controller.hasSelection }
                        onClick     = {() => { onClickSendAssets ()}}
                    />
                    <Dropdown item icon = "industry">
                        <Dropdown.Menu>
                            { methodListItems }
                        </Dropdown.Menu>
                    </Dropdown>
                </Menu.Menu>
            </Menu>

            <TransactionModal
                appState    = { appState }
                controller  = { transactionController }
                open        = { transactionController !== false }
                onClose     = { onCloseTransactionModal }
            />

        </React.Fragment>
    );
});