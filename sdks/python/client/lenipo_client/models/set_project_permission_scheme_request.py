from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="SetProjectPermissionSchemeRequest")



@_attrs_define
class SetProjectPermissionSchemeRequest:
    """ 
        Attributes:
            scheme_id (None | UUID):
     """

    scheme_id: None | UUID
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        scheme_id: None | str
        if isinstance(self.scheme_id, UUID):
            scheme_id = str(self.scheme_id)
        else:
            scheme_id = self.scheme_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "schemeId": scheme_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_scheme_id(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                scheme_id_type_0 = UUID(data)



                return scheme_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        scheme_id = _parse_scheme_id(d.pop("schemeId"))


        set_project_permission_scheme_request = cls(
            scheme_id=scheme_id,
        )


        set_project_permission_scheme_request.additional_properties = d
        return set_project_permission_scheme_request

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
