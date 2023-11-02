import { LightningElement, api, track } from "lwc";
import save from "@salesforce/apex/DNDSortingController.saveSorting";
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { FlowNavigationFinishEvent, FlowNavigationNextEvent } from 'lightning/flowSupport';

const CANCEL_LITERAL = "Cancel"
const SAVE_LITERAL = "Save"

export default class DndSortingTable extends LightningElement {
    dragStartIndexes = []
    @track tableRows = []
    startCopy = []
    @api records
    @api displayField
    @api sortingField
    @api availableActions = []

    cancelButtonLabel = CANCEL_LITERAL
    cancelButtonName = CANCEL_LITERAL
    saveButtonLabel = SAVE_LITERAL
    saveButtonName = SAVE_LITERAL

    init = true
    dropEvent = false

    connectedCallback() {
        if (!this.displayField || !this.sortingField || !this.records) return

        const tempRecords = []
        this.records.forEach(record => {
            const recordCopy = JSON.parse(JSON.stringify(record))
            recordCopy.Name = recordCopy[this.displayField]
            tempRecords.push(recordCopy)
        })
        this.startCopy = JSON.parse(JSON.stringify(tempRecords))
        this.tableRows = tempRecords

        Array.prototype.replace = function (from, to, amount) {
            if (from < to && amount > 1) {
                to -= (amount - 1)
            }
            this.splice(to, 0, ...this.splice(from, amount))
        }
    }

    renderedCallback() {
        if (this.init) {
            this.init = false
            this.template.querySelectorAll('td').forEach(element => {
                this.adjustDragOverElementHeight(element, true)
            })
        }
    }

    cancel(evt) {
        if (evt.preventDefault) evt.preventDefault()
        if (evt.stopPropagation) evt.stopPropagation()
    };

    //remove non-sibling selections
    removeNonRelativeSelections(dragStartIndexes, dragStartElementId) {
        const dragStartElementsFiltered1 = []
        const dragStartElementsFiltered2 = []
        for (const index of dragStartIndexes) {
            if (!dragStartElementsFiltered1.length || (index - dragStartElementsFiltered1[dragStartElementsFiltered1.length - 1]) === 1) {
                dragStartElementsFiltered1.push(index)
            }
            else dragStartElementsFiltered2.push(index)
        }
        const dragStartIndex = this.tableRows.findIndex(item => item.Id === dragStartElementId)
        let outputArr, wrongElements
        if (dragStartElementsFiltered1.includes(dragStartIndex)) {
            outputArr = dragStartElementsFiltered1
            wrongElements = this.tableRows.filter((item, index) => dragStartElementsFiltered2.includes(index))
        }
        else if (dragStartElementsFiltered2.includes(dragStartIndex)) {
            outputArr = dragStartElementsFiltered2
            wrongElements = this.tableRows.filter((item, index) => dragStartElementsFiltered1.includes(index))
        }
        for (const wrongEl of wrongElements) {
            const selectedEl = this.template.querySelector(`[data-id="${wrongEl.Id}"]`).childNodes[0]
            selectedEl.classList.remove('selected')
            selectedEl.classList.add('initial-border')
        }
        return outputArr
    }
    
    dragStart(event) {
        const elementId = event.currentTarget.dataset.id        
        const selectedEl = this.template.querySelector(`[data-id="${elementId}"]`).childNodes[0]
        selectedEl.classList.remove('initial-border')
        selectedEl.classList.add('selected')
        this.dragStartIndexes = this.removeNonRelativeSelections(this.getSelectedRowsIndexes(), elementId)
        const draggableItems = this.tableRows.filter((item, index) => this.dragStartIndexes.includes(index))
        for (const item of draggableItems) {
            const selected = this.template.querySelector(`[data-id="${item.Id}"]`).childNodes[0]
            selected.classList.add('draggable')
        }
    }

    dragEnd(event) {
        this.cancel(event)
        if (!this.dropEvent) {
            const draggableItems = this.tableRows.filter((item, index) => this.dragStartIndexes.includes(index))
            for (const item of draggableItems) {
                const selected = this.template.querySelector(`[data-id="${item.Id}"]`).childNodes[0]
                selected.classList.remove('draggable')
                selected.classList.add('selected')
            }
            this.dragStartIndexes = []
        }
        else this.dropEvent = false
    }

    dragEnter(event) {
        this.cancel(event)
        const dragOverElementId = event.currentTarget.dataset.id
        const dragOverElementIndex = this.tableRows.findIndex(element => element.Id === dragOverElementId)
        const dragOverEl = this.template.querySelector(`[data-id="${dragOverElementId}"]`).childNodes[0]        
        if (!this.dragStartIndexes.includes(dragOverElementIndex)) {
            this.addDragOverStyle(dragOverEl, this.getDragOverClass(event.clientY, dragOverEl.getBoundingClientRect()))
        }
    }

    dragOver(event) {
        this.cancel(event)
        const dragOverElementId = event.currentTarget.dataset.id
        const dragOverElementIndex = this.tableRows.findIndex(element => element.Id === dragOverElementId)
        const dragOverEl = this.template.querySelector(`[data-id="${dragOverElementId}"]`).childNodes[0]
        if (!this.dragStartIndexes.includes(dragOverElementIndex)) {
            this.removeDragOverStyle(dragOverEl)
            this.addDragOverStyle(dragOverEl, this.getDragOverClass(event.clientY, dragOverEl.getBoundingClientRect()))
        }
    }

    dragLeave(event) {
        this.cancel(event)
        const dragOverElementId = event.currentTarget.dataset.id
        const dragOverElementIndex = this.tableRows.findIndex(element => element.Id === dragOverElementId)
        if (!this.dragStartIndexes.includes(dragOverElementIndex)) {
            this.removeDragOverStyle(this.template.querySelector(`[data-id="${dragOverElementId}"]`).childNodes[0])
        }
    }
    
    async drop(event) {
        this.cancel(event)
        this.dropEvent = true
        const dropTargetId = event.currentTarget.dataset.id
        let newIndex = this.tableRows.findIndex(item => item.Id === dropTargetId)
        const dropTarget = this.template.querySelector(`[data-id="${dropTargetId}"]`).childNodes[0]
        let dontRegulateDropTargetHeight = false
        const containsDropTopBorder = dropTarget.classList.contains("drop-border_top")
        const containsDropBottomBorder = dropTarget.classList.contains("drop-border_bottom")
        if (this.dragStartIndexes[0] < newIndex && containsDropTopBorder) {
            newIndex--
        }
        else if (this.dragStartIndexes[0] > newIndex && containsDropBottomBorder) {
            newIndex++
        }
        else if (!containsDropTopBorder && !containsDropBottomBorder) {
            dontRegulateDropTargetHeight = true
        }
        await this.clearStyles()
        if (!dontRegulateDropTargetHeight) {
            this.adjustDragOverElementHeight(dropTarget, true)
        }
        if (this.dragStartIndexes.includes(newIndex)) {
            return
        }

        this.tableRows.replace(this.dragStartIndexes[0], newIndex, this.dragStartIndexes.length)
        this.dragStartIndexes = []
    }

    async handleRowClick(event) {
        const elementId = event.currentTarget.dataset.id
        const lastSelectedEl = this.template.querySelector(`[data-id="${elementId}"]`).childNodes[0]
        const lastSelectedElIndex = this.tableRows.findIndex(element => element.Id === elementId)
        if (this.handleKey(event)) {
            if (event.ctrlKey || event.metaKey) {
                if (this.isSibling(elementId)) {
                    lastSelectedEl.classList.remove('initial-border')
                    lastSelectedEl.classList.add('selected')
                    return
                }
                else await this.clearStyles()
            }
            else if (event.shiftKey) {
                const selectedIndexes = this.getSelectedRowsIndexes()
                if (selectedIndexes.length) {
                    if (selectedIndexes.includes(lastSelectedElIndex)) {
                        return
                    }
                    else if (selectedIndexes[0] > lastSelectedElIndex) {
                        for (let i = lastSelectedElIndex; i < selectedIndexes[0]; i++) {
                            const element = this.template.querySelector(`[data-id="${this.tableRows[i].Id}"]`).children[0]
                            element.classList.remove('initial-border')
                            element.classList.add('selected')
                        }
                    }
                    else if (selectedIndexes[selectedIndexes.length - 1] < lastSelectedElIndex) {
                        for (let i = lastSelectedElIndex; i > selectedIndexes[selectedIndexes.length - 1]; i--) {
                            const element = this.template.querySelector(`[data-id="${this.tableRows[i].Id}"]`).children[0]
                            element.classList.remove('initial-border')
                            element.classList.add('selected')
                        }
                    }
                }
            }
        }
        else await this.clearStyles()
        lastSelectedEl.classList.remove('initial-border')
        lastSelectedEl.classList.add('selected')
    }

    getDragOverClass(mouseClientY, elementClientRect) {
        let className = "drop-border_top"
        if ((elementClientRect.bottom - mouseClientY) < ((elementClientRect.bottom - elementClientRect.top) / 2)) {
            className = "drop-border_bottom"
        }
        return className
    }

    //Set the style to indicate the element is being dragged over
    addDragOverStyle(targetElement, className) {
        targetElement.classList.remove('initial-border')
        targetElement.classList.add(className)
        targetElement.style.height = (targetElement.offsetHeight - 3.2) + "px"
        this.adjustDragOverElementHeight(targetElement, false)
    }

    //Reset the style
    removeDragOverStyle(targetElement) {
        targetElement.classList.remove("drop-border_top")
        targetElement.classList.remove("drop-border_bottom")
        targetElement.classList.add('initial-border')
        this.adjustDragOverElementHeight(targetElement, true)
    }

    adjustDragOverElementHeight(element, plus) {
        element.style.height = (element.offsetHeight + (plus ? 3.2 : -3.2)) + "px"
    }

    clearStyles() {
        return new Promise(resolve => {
            this.template.querySelectorAll('td').forEach(element => {
                while (element.classList.length > 0) {
                    element.classList.remove(element.classList.item(0))
                }
                element.classList.add("initial-border")
            })
            resolve()
        })
    }

    isSibling(lastSelectedElementId) {
        const selectedIndexes = this.getSelectedRowsIndexes()
        const lastSelectedIndex = this.tableRows.findIndex(element => element.Id === lastSelectedElementId)
        if (selectedIndexes.includes(lastSelectedIndex) || (selectedIndexes.length && ((selectedIndexes[0] - 1) === lastSelectedIndex || (selectedIndexes[selectedIndexes.length - 1] + 1) === lastSelectedIndex))) {
            return true
        }
        return false
    }

    handleKey(event) {
        return event.ctrlKey || event.shiftKey || event.metaKey
    }

    getSelectedRows() {
        return this.template.querySelectorAll("td.selected")
    }    

    getSelectedRowsIndexes() {
        const selectedIndexes = []
        this.getSelectedRows().forEach(selectedEl => selectedIndexes.push(this.tableRows.findIndex(element => element.Id === selectedEl.parentNode.dataset.id)))
        return selectedIndexes
    }

    async handleAction(event) {
        const buttonName = event.target.name
        if (buttonName === this.cancelButtonName) {
            this.clearStyles()
            this.tableRows = JSON.parse(JSON.stringify(this.startCopy))
        }
        else if (buttonName === this.saveButtonName) {
            const sortedElements = JSON.parse(JSON.stringify(this.tableRows))
            for (const element of sortedElements) {
                for (const propertyName in element) {
                    if (!["Id", this.displayField, this.sortingField].includes(propertyName)) {
                        delete element[propertyName]
                    }
                }
            }
            try {
                await save({ records : sortedElements, sortingField : this.sortingField})
            }
            catch (error) {
                console.error(error)
                this.showToast("", "error", error.message ? error.message : error.body.message)
                return
            }
            this.showToast("", "success", "The order of records successfully saved", "dismissable")
            this.sendEventToFlow()
        }
    }

    showToast(title, variant, message, mode = 'sticky') {
        const event = new ShowToastEvent({
            variant: variant,
            title: title,
            message: message,
            mode: mode
        });
        this.dispatchEvent(event);
    }

    sendEventToFlow() {
        if (this.availableActions.includes("NEXT")) {
            this.dispatchEvent(new FlowNavigationNextEvent())
        }
        else if (this.availableActions.includes("FINISH")) {
            this.dispatchEvent(new FlowNavigationFinishEvent())
        }
    }
}