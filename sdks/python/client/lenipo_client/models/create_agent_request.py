from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID






T = TypeVar("T", bound="CreateAgentRequest")



@_attrs_define
class CreateAgentRequest:
    """ 
        Attributes:
            display_name (str):
            vendor (str):
            model (str | Unset):  Default: ''.
            task_filter (str | Unset):  Default: ''.
            owner_id (UUID | Unset):
            groups (list[str] | Unset):
     """

    display_name: str
    vendor: str
    model: str | Unset = ''
    task_filter: str | Unset = ''
    owner_id: UUID | Unset = UNSET
    groups: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        display_name = self.display_name

        vendor = self.vendor

        model = self.model

        task_filter = self.task_filter

        owner_id: str | Unset = UNSET
        if not isinstance(self.owner_id, Unset):
            owner_id = str(self.owner_id)

        groups: list[str] | Unset = UNSET
        if not isinstance(self.groups, Unset):
            groups = self.groups




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "displayName": display_name,
            "vendor": vendor,
        })
        if model is not UNSET:
            field_dict["model"] = model
        if task_filter is not UNSET:
            field_dict["taskFilter"] = task_filter
        if owner_id is not UNSET:
            field_dict["ownerId"] = owner_id
        if groups is not UNSET:
            field_dict["groups"] = groups

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        display_name = d.pop("displayName")

        vendor = d.pop("vendor")

        model = d.pop("model", UNSET)

        task_filter = d.pop("taskFilter", UNSET)

        _owner_id = d.pop("ownerId", UNSET)
        owner_id: UUID | Unset
        if isinstance(_owner_id,  Unset):
            owner_id = UNSET
        else:
            owner_id = UUID(_owner_id)




        groups = cast(list[str], d.pop("groups", UNSET))


        create_agent_request = cls(
            display_name=display_name,
            vendor=vendor,
            model=model,
            task_filter=task_filter,
            owner_id=owner_id,
            groups=groups,
        )


        create_agent_request.additional_properties = d
        return create_agent_request

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
