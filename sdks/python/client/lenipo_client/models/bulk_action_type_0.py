from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from typing import Literal, cast
from uuid import UUID






T = TypeVar("T", bound="BulkActionType0")



@_attrs_define
class BulkActionType0:
    """ 
        Attributes:
            type_ (Literal['edit']):
            assignee_id (None | Unset | UUID):
            priority (str | Unset):
            add_labels (list[str] | Unset):
            remove_labels (list[str] | Unset):
     """

    type_: Literal['edit']
    assignee_id: None | Unset | UUID = UNSET
    priority: str | Unset = UNSET
    add_labels: list[str] | Unset = UNSET
    remove_labels: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        assignee_id: None | str | Unset
        if isinstance(self.assignee_id, Unset):
            assignee_id = UNSET
        elif isinstance(self.assignee_id, UUID):
            assignee_id = str(self.assignee_id)
        else:
            assignee_id = self.assignee_id

        priority = self.priority

        add_labels: list[str] | Unset = UNSET
        if not isinstance(self.add_labels, Unset):
            add_labels = self.add_labels



        remove_labels: list[str] | Unset = UNSET
        if not isinstance(self.remove_labels, Unset):
            remove_labels = self.remove_labels




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
        })
        if assignee_id is not UNSET:
            field_dict["assigneeId"] = assignee_id
        if priority is not UNSET:
            field_dict["priority"] = priority
        if add_labels is not UNSET:
            field_dict["addLabels"] = add_labels
        if remove_labels is not UNSET:
            field_dict["removeLabels"] = remove_labels

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['edit'] , d.pop("type"))
        if type_ != 'edit':
            raise ValueError(f"type must match const 'edit', got '{type_}'")

        def _parse_assignee_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                assignee_id_type_0 = UUID(data)



                return assignee_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        assignee_id = _parse_assignee_id(d.pop("assigneeId", UNSET))


        priority = d.pop("priority", UNSET)

        add_labels = cast(list[str], d.pop("addLabels", UNSET))


        remove_labels = cast(list[str], d.pop("removeLabels", UNSET))


        bulk_action_type_0 = cls(
            type_=type_,
            assignee_id=assignee_id,
            priority=priority,
            add_labels=add_labels,
            remove_labels=remove_labels,
        )


        bulk_action_type_0.additional_properties = d
        return bulk_action_type_0

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
