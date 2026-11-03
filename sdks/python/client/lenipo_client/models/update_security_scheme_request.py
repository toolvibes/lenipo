from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.update_security_scheme_request_levels_item import UpdateSecuritySchemeRequestLevelsItem





T = TypeVar("T", bound="UpdateSecuritySchemeRequest")



@_attrs_define
class UpdateSecuritySchemeRequest:
    """ 
        Attributes:
            name (str | Unset):
            description (str | Unset):
            levels (list[UpdateSecuritySchemeRequestLevelsItem] | Unset):
            default_level (int | None | Unset):
     """

    name: str | Unset = UNSET
    description: str | Unset = UNSET
    levels: list[UpdateSecuritySchemeRequestLevelsItem] | Unset = UNSET
    default_level: int | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.update_security_scheme_request_levels_item import UpdateSecuritySchemeRequestLevelsItem # noqa: PLC0415
        name = self.name

        description = self.description

        levels: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.levels, Unset):
            levels = []
            for levels_item_data in self.levels:
                levels_item = levels_item_data.to_dict()
                levels.append(levels_item)



        default_level: int | None | Unset
        if isinstance(self.default_level, Unset):
            default_level = UNSET
        else:
            default_level = self.default_level


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if name is not UNSET:
            field_dict["name"] = name
        if description is not UNSET:
            field_dict["description"] = description
        if levels is not UNSET:
            field_dict["levels"] = levels
        if default_level is not UNSET:
            field_dict["defaultLevel"] = default_level

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.update_security_scheme_request_levels_item import UpdateSecuritySchemeRequestLevelsItem # noqa: PLC0415
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        description = d.pop("description", UNSET)

        _levels = d.pop("levels", UNSET)
        levels: list[UpdateSecuritySchemeRequestLevelsItem] | Unset = UNSET
        if _levels is not UNSET:
            levels = []
            for levels_item_data in _levels:
                levels_item = UpdateSecuritySchemeRequestLevelsItem.from_dict(levels_item_data)



                levels.append(levels_item)


        def _parse_default_level(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        default_level = _parse_default_level(d.pop("defaultLevel", UNSET))


        update_security_scheme_request = cls(
            name=name,
            description=description,
            levels=levels,
            default_level=default_level,
        )


        update_security_scheme_request.additional_properties = d
        return update_security_scheme_request

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
