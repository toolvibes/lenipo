from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from uuid import UUID






T = TypeVar("T", bound="CreatePermissionSchemeRequest")



@_attrs_define
class CreatePermissionSchemeRequest:
    """ 
        Attributes:
            name (str):
            description (str | Unset):  Default: ''.
            copy_from_id (UUID | Unset):
     """

    name: str
    description: str | Unset = ''
    copy_from_id: UUID | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        description = self.description

        copy_from_id: str | Unset = UNSET
        if not isinstance(self.copy_from_id, Unset):
            copy_from_id = str(self.copy_from_id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "name": name,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if copy_from_id is not UNSET:
            field_dict["copyFromId"] = copy_from_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        description = d.pop("description", UNSET)

        _copy_from_id = d.pop("copyFromId", UNSET)
        copy_from_id: UUID | Unset
        if isinstance(_copy_from_id,  Unset):
            copy_from_id = UNSET
        else:
            copy_from_id = UUID(_copy_from_id)




        create_permission_scheme_request = cls(
            name=name,
            description=description,
            copy_from_id=copy_from_id,
        )


        create_permission_scheme_request.additional_properties = d
        return create_permission_scheme_request

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
