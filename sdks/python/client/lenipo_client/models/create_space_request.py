from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_space_request_type import CreateSpaceRequestType
from ..types import UNSET, Unset
from typing import cast






T = TypeVar("T", bound="CreateSpaceRequest")



@_attrs_define
class CreateSpaceRequest:
    """ 
        Attributes:
            key (str):
            name (str):
            description (str | Unset):  Default: ''.
            type_ (CreateSpaceRequestType | Unset):
            project_key (None | str | Unset):
     """

    key: str
    name: str
    description: str | Unset = ''
    type_: CreateSpaceRequestType | Unset = UNSET
    project_key: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        key = self.key

        name = self.name

        description = self.description

        type_: str | Unset = UNSET
        if not isinstance(self.type_, Unset):
            type_ = self.type_.value


        project_key: None | str | Unset
        if isinstance(self.project_key, Unset):
            project_key = UNSET
        else:
            project_key = self.project_key


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "key": key,
            "name": name,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if type_ is not UNSET:
            field_dict["type"] = type_
        if project_key is not UNSET:
            field_dict["projectKey"] = project_key

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = d.pop("key")

        name = d.pop("name")

        description = d.pop("description", UNSET)

        _type_ = d.pop("type", UNSET)
        type_: CreateSpaceRequestType | Unset
        if isinstance(_type_,  Unset):
            type_ = UNSET
        else:
            type_ = CreateSpaceRequestType(_type_)




        def _parse_project_key(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        project_key = _parse_project_key(d.pop("projectKey", UNSET))


        create_space_request = cls(
            key=key,
            name=name,
            description=description,
            type_=type_,
            project_key=project_key,
        )


        create_space_request.additional_properties = d
        return create_space_request

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
