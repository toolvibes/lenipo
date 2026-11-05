from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime

if TYPE_CHECKING:
  from ..models.inactive_project_spaces_item import InactiveProjectSpacesItem





T = TypeVar("T", bound="InactiveProject")



@_attrs_define
class InactiveProject:
    """ 
        Attributes:
            key (str):
            name (str):
            archived_at (datetime.datetime):
            deleted_at (datetime.datetime | None):
            purge_at (datetime.datetime | None):
            spaces (list[InactiveProjectSpacesItem]):
     """

    key: str
    name: str
    archived_at: datetime.datetime
    deleted_at: datetime.datetime | None
    purge_at: datetime.datetime | None
    spaces: list[InactiveProjectSpacesItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.inactive_project_spaces_item import InactiveProjectSpacesItem # noqa: PLC0415
        key = self.key

        name = self.name

        archived_at = self.archived_at.isoformat()

        deleted_at: None | str
        if isinstance(self.deleted_at, datetime.datetime):
            deleted_at = self.deleted_at.isoformat()
        else:
            deleted_at = self.deleted_at

        purge_at: None | str
        if isinstance(self.purge_at, datetime.datetime):
            purge_at = self.purge_at.isoformat()
        else:
            purge_at = self.purge_at

        spaces = []
        for spaces_item_data in self.spaces:
            spaces_item = spaces_item_data.to_dict()
            spaces.append(spaces_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "key": key,
            "name": name,
            "archivedAt": archived_at,
            "deletedAt": deleted_at,
            "purgeAt": purge_at,
            "spaces": spaces,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.inactive_project_spaces_item import InactiveProjectSpacesItem # noqa: PLC0415
        d = dict(src_dict)
        key = d.pop("key")

        name = d.pop("name")

        archived_at = datetime.datetime.fromisoformat(d.pop("archivedAt"))




        def _parse_deleted_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                deleted_at_type_0 = datetime.datetime.fromisoformat(data)



                return deleted_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        deleted_at = _parse_deleted_at(d.pop("deletedAt"))


        def _parse_purge_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                purge_at_type_0 = datetime.datetime.fromisoformat(data)



                return purge_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        purge_at = _parse_purge_at(d.pop("purgeAt"))


        spaces = []
        _spaces = d.pop("spaces")
        for spaces_item_data in (_spaces):
            spaces_item = InactiveProjectSpacesItem.from_dict(spaces_item_data)



            spaces.append(spaces_item)


        inactive_project = cls(
            key=key,
            name=name,
            archived_at=archived_at,
            deleted_at=deleted_at,
            purge_at=purge_at,
            spaces=spaces,
        )

        return inactive_project

