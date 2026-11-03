from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ReleaseVersionRequest")



@_attrs_define
class ReleaseVersionRequest:
    """ 
        Attributes:
            release_date (datetime.date | Unset):
            move_open_to (None | Unset | UUID):
     """

    release_date: datetime.date | Unset = UNSET
    move_open_to: None | Unset | UUID = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        release_date: str | Unset = UNSET
        if not isinstance(self.release_date, Unset):
            release_date = self.release_date.isoformat()

        move_open_to: None | str | Unset
        if isinstance(self.move_open_to, Unset):
            move_open_to = UNSET
        elif isinstance(self.move_open_to, UUID):
            move_open_to = str(self.move_open_to)
        else:
            move_open_to = self.move_open_to


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if release_date is not UNSET:
            field_dict["releaseDate"] = release_date
        if move_open_to is not UNSET:
            field_dict["moveOpenTo"] = move_open_to

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _release_date = d.pop("releaseDate", UNSET)
        release_date: datetime.date | Unset
        if isinstance(_release_date,  Unset):
            release_date = UNSET
        else:
            release_date = datetime.date.fromisoformat(_release_date)




        def _parse_move_open_to(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                move_open_to_type_0 = UUID(data)



                return move_open_to_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        move_open_to = _parse_move_open_to(d.pop("moveOpenTo", UNSET))


        release_version_request = cls(
            release_date=release_date,
            move_open_to=move_open_to,
        )


        release_version_request.additional_properties = d
        return release_version_request

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
