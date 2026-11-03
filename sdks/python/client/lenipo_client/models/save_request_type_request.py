from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="SaveRequestTypeRequest")



@_attrs_define
class SaveRequestTypeRequest:
    """ 
        Attributes:
            name (str):
            issue_type (str):
            description (str | Unset):  Default: ''.
            fields (list[str] | Unset):
     """

    name: str
    issue_type: str
    description: str | Unset = ''
    fields: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        issue_type = self.issue_type

        description = self.description

        fields: list[str] | Unset = UNSET
        if not isinstance(self.fields, Unset):
            fields = self.fields




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "issueType": issue_type,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if fields is not UNSET:
            field_dict["fields"] = fields

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        issue_type = d.pop("issueType")

        description = d.pop("description", UNSET)

        fields = cast(list[str], d.pop("fields", UNSET))


        save_request_type_request = cls(
            name=name,
            issue_type=issue_type,
            description=description,
            fields=fields,
        )


        save_request_type_request.additional_properties = d
        return save_request_type_request

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
