from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.directory_type import DirectoryType
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.directory_config_type_0 import DirectoryConfigType0





T = TypeVar("T", bound="Directory")



@_attrs_define
class Directory:
    """ 
        Attributes:
            id (UUID):
            name (str):
            type_ (DirectoryType):
            position (int):
            enabled (bool):
            config (DirectoryConfigType0 | None):
            users (int):
            last_sync_at (datetime.datetime | None):
            last_sync_result (None | str):
     """

    id: UUID
    name: str
    type_: DirectoryType
    position: int
    enabled: bool
    config: DirectoryConfigType0 | None
    users: int
    last_sync_at: datetime.datetime | None
    last_sync_result: None | str





    def to_dict(self) -> dict[str, Any]:
        from ..models.directory_config_type_0 import DirectoryConfigType0 # noqa: PLC0415
        id = str(self.id)

        name = self.name

        type_ = self.type_.value

        position = self.position

        enabled = self.enabled

        config: dict[str, Any] | None
        if isinstance(self.config, DirectoryConfigType0):
            config = self.config.to_dict()
        else:
            config = self.config

        users = self.users

        last_sync_at: None | str
        if isinstance(self.last_sync_at, datetime.datetime):
            last_sync_at = self.last_sync_at.isoformat()
        else:
            last_sync_at = self.last_sync_at

        last_sync_result: None | str
        last_sync_result = self.last_sync_result


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "type": type_,
            "position": position,
            "enabled": enabled,
            "config": config,
            "users": users,
            "lastSyncAt": last_sync_at,
            "lastSyncResult": last_sync_result,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.directory_config_type_0 import DirectoryConfigType0 # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        type_ = DirectoryType(d.pop("type"))




        position = d.pop("position")

        enabled = d.pop("enabled")

        def _parse_config(data: object) -> DirectoryConfigType0 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                config_type_0 = DirectoryConfigType0.from_dict(data)



                return config_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(DirectoryConfigType0 | None, data)

        config = _parse_config(d.pop("config"))


        users = d.pop("users")

        def _parse_last_sync_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                last_sync_at_type_0 = datetime.datetime.fromisoformat(data)



                return last_sync_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        last_sync_at = _parse_last_sync_at(d.pop("lastSyncAt"))


        def _parse_last_sync_result(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        last_sync_result = _parse_last_sync_result(d.pop("lastSyncResult"))


        directory = cls(
            id=id,
            name=name,
            type_=type_,
            position=position,
            enabled=enabled,
            config=config,
            users=users,
            last_sync_at=last_sync_at,
            last_sync_result=last_sync_result,
        )

        return directory

