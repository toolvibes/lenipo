from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_custom_field_request_type import CreateCustomFieldRequestType
from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="CreateCustomFieldRequest")



@_attrs_define
class CreateCustomFieldRequest:
    """ 
        Attributes:
            name (str):
            type_ (CreateCustomFieldRequestType):
            description (str | Unset):  Default: ''.
            options (list[str] | Unset):
     """

    name: str
    type_: CreateCustomFieldRequestType
    description: str | Unset = ''
    options: list[str] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        type_ = self.type_.value

        description = self.description

        options: list[str] | Unset = UNSET
        if not isinstance(self.options, Unset):
            options = self.options




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
            "type": type_,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if options is not UNSET:
            field_dict["options"] = options

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        type_ = CreateCustomFieldRequestType(d.pop("type"))




        description = d.pop("description", UNSET)

        options = cast(list[str], d.pop("options", UNSET))


        create_custom_field_request = cls(
            name=name,
            type_=type_,
            description=description,
            options=options,
        )


        create_custom_field_request.additional_properties = d
        return create_custom_field_request

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
